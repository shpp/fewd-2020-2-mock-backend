import { rethrowErrors } from './fix-stacktraces-hack';
import { Router } from 'itty-router';
import { corsObj } from './cors';

// this var may appear if your custom builder injects this variable into final script
declare global {
  let buildMetadata: { time: number };
}
const buildMeta: { time: number } = (() => {
  try {
    return buildMetadata;
  } catch (_) {
    return { time: 0 };
  }
})();
const build = new Date(buildMeta.time).toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SafeAny = any;

export interface LogEntry {
  time: string;
  message: string;
  [s: string]: unknown;
}

export interface RouterExtra {
  // if SENTRY_PROJECT env var is set, OR ?project=... is set for SENTRY_DSN var
  // then returns link to Sentry like https://sentry.io/organizations/<PROJECT>/issues?query=<SENTRYID>
  // ...alternatively please set ROLLBAR_TOKEN
  captureError: (e: Error, data?: { [s: string]: string | number | boolean }) => string;
  // logs will be sent to Sentry|Rollbar, also probably somewhere else
  log: (message: string, data?: { [s: string]: string | number | boolean }) => void;
  // to override anything in Response, even if everything crashes
  forceHeaders: { [s: string]: string };
  capturedBody: string | undefined;
  // needed for extra-sensitive parts of system, e.g. when we're passing original request to Durable Object
  origRequest: Request;
  startedAt: number;
  executionContext: ExecutionContext;
}

function genHeaders(
  errotTrackingUrl: string | undefined,
  forceHeaders: { [s: string]: string }
): { [s: string]: string } {
  return {
    build,
    'X-Robots-Tag': 'none',
    ...(errotTrackingUrl ? { debugUrl: errotTrackingUrl } : {}),
    ...forceHeaders,
  };
}

export function wrapRequest(request: Request, cont?: { capturedBody: string | undefined }): Request {
  cont ??= { capturedBody: '' };
  return new Proxy(request, {
    get: (t, prop) => {
      if (prop === 'json') return async () => JSON.parse((cont!.capturedBody = await request.text()));
      if (prop === 'text') return async () => (cont!.capturedBody = await request.text());
      if (prop === 'formData')
        return async () => {
          const fd = await request.formData();
          cont!.capturedBody = [...fd.entries()]
            .map((e) => encodeURIComponent(e[0]) + '=' + encodeURIComponent(e[1] + ''))
            .join('&');
          return fd;
        };
      if (prop === 'arrayBuffer') return async () => rethrowErrors(request, request.arrayBuffer);
      if (prop === 'blob') return async () => rethrowErrors(request, request.blob);
      return (request as SafeAny)[prop];
    },
  });
}

export type CaptureErrorFunc = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  build: string,
  request: Request,
  capturedBody: string | undefined,
  logs: unknown[],
  e: Error,
  ctx: ExecutionContext,
  data?: { [s: string]: unknown }
) => { errorTrackerUrl: string; errorTrackingId: string } | undefined;

export function handleHttpRequests<Env>(
  setupRouting: (router: Router) => void,
  captureErrorFunc: CaptureErrorFunc
): ExportedHandlerFetchHandler<Env> {
  // create Router so user will use it to configure routes
  const router = Router();

  // give user an opportunity to configure routes
  setupRouting(router);

  // return HTTP request processor
  return async (origRequest: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    // we'll allow user to log something
    // logs will trap into error tracking system ... or just somewhere/nowhere if you like
    const logs: LogEntry[] = [];
    // if we will
    let errorTrackerUrl: string | undefined = undefined;

    const extra: RouterExtra = {
      executionContext: ctx,
      origRequest,
      startedAt: Date.now(),
      captureError: (e: Error, data?: { [s: string]: string | number | boolean }): string => {
        const captured = captureErrorFunc(env, build, request, extra.capturedBody, logs, e, ctx, {
          ...(data || {}),
          requestBody: extra.capturedBody,
          logs,
          t: new Date().toISOString(),
          build,
        });
        if (captured) {
          return (errorTrackerUrl = captured.errorTrackerUrl);
        }
        return `https://error-tracking-not-configured`;
      },
      log: (message: string, data?: { [s: string]: string | number | boolean }) => {
        const m = { time: new Date().toISOString(), message, ...(data || {}) };
        logs.push(m);
        console.log(
          m.time.replace('T', ' ').split('.')[0] + ': ' + m.message + (data ? ' ' + JSON.stringify(data) : '')
        );
      },
      forceHeaders: {},
      capturedBody: undefined,
    };
    const request: Request = wrapRequest(origRequest, extra);

    try {
      const resp =
        (await router.handle(request, env, ctx, extra)) ||
        (() => {
          throw new Error('no response');
        })();
      if ((resp as Response).status === 101) return resp;

      const respWithHeaders = new Response(resp.body, {
        headers: {
          ...Object.fromEntries([...(resp?.headers?.entries() || [])]),
          ...genHeaders(errorTrackerUrl, extra.forceHeaders),
          ...corsObj,
        },
        status: resp.status || 200,
        statusText: resp.statusText || 'CODE' + (resp.status || 200),
      });
      return respWithHeaders;
    } catch (e) {
      const errorTrackingUrl = extra.captureError(e as Error, { crash: true });

      const errorMessage =
        'CRASH: ' + '/\n' + (e as Error).stack + '\n\nGive it to programmers: ' + errorTrackingUrl + '\n';

      if (request.headers.get('Upgrade') == 'websocket') {
        // Annoyingly, if we return an HTTP error in response to a WebSocket request, Chrome devtools
        // won't show us the response body! So... let's send a WebSocket response with an error frame instead.
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({ error: errorMessage }));
        pair[1].close(1011, 'Uncaught exception during session setup');
        return new Response(null, { status: 101, webSocket: pair[0] });
      }

      return new Response(errorMessage, {
        status: 500,
        headers: genHeaders(errorTrackingUrl, extra.forceHeaders),
      });
    }
  };
}
