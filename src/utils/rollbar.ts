import { isLocalDev } from './miniflare';

export function rollbarCaptureError(
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  env: any,
  build: string,
  request: Request,
  capturedBody: string | undefined,
  logs: unknown[],
  e: Error,
  ctx: ExecutionContext,
  data?: { [s: string]: unknown }
): { errorTrackerUrl: string; errorTrackingId: string } | undefined {
  const rollbarToken = env.ROLLBAR_TOKEN;
  if (rollbarToken) {
    const res = sendToRollbar(rollbarToken, 'prod', 'error', build, e, request, {
      ...(data || {}),
      requestBody: capturedBody,
      logs,
      t: new Date().toISOString(),
      build,
    });
    const errorTrackingId = res.eventId;
    const errorTrackerUrl = 'https://rollbar.com/occurrence/uuid/?uuid=' + errorTrackingId; // `https://sentry.io/organizations/${proj}/issues?query=${sentryId}`;
    ctx.waitUntil(res.posted); //sentryRes.posted);
    return { errorTrackerUrl, errorTrackingId };
  }
  return undefined;
}

export function sendToRollbar(
  token: string,
  environment: string,
  level: string,
  build: string,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  err: any,
  request: Request,
  data: { [s: string]: unknown }
): { posted: Promise<Response>; eventId: string } {
  const eventId = crypto.randomUUID();
  if (!(err instanceof Error)) {
    err = Object.prototype.valueOf.call(err ?? {});
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    (Error as any).captureStackTrace(err, sendToRollbar);
  }

  const parsedError = parseError(err);
  const posted = fetch('https://api.rollbar.com/api/1/item/', {
    method: 'POST',
    body: JSON.stringify({
      access_token: token,
      data: {
        environment,
        body: {
          trace: {
            frames: parsedError.stack.map((x) => ({
              filename: x.url,
              lineno: x.line,
              colno: x.column,
              method: x.class + '.' + x.func,
              class_name: x.class,
              code: x.orig,
            })),
            exception: {
              class: parsedError.name,
              message: parsedError.message,
            },
          },
        },
        level,
        timestamp: Math.floor(Date.now() / 1000),
        code_version: new Date(build).getTime(),
        platform: isLocalDev() ? 'localdev' : 'cloudflare-workers',
        language: 'javascript',
        request: {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries([...request.headers.entries()]),
          body: data.requestBody,
          //   user_ip: "" -- already present in headers
        },
        custom: {
          ...data,
          stack: err.stack,
        },
        uuid: eventId,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return { eventId, posted };
}

export interface StackElem {
  url: string | null;
  func: string;
  line: number | null;
  column: number | null;
  orig: string;
  class: string;
}

export function parseError(error: Error): {
  name: string;
  message: string;
  stack: StackElem[];
} {
  const lines = error.stack ? error.stack.split('\n') : [];
  const stack: StackElem[] = [];
  for (const line of lines) {
    if (!line.match(/^\s+at/)) continue;
    const afterat = line.split(/\sat\s/)[1];
    if (!afterat) continue;
    const splitted = afterat.split(/\s+/);
    const raw = [
      splitted.slice(0, splitted.length - 2).join(' '),
      splitted[splitted.length - 2],
      splitted[splitted.length - 1],
    ].map((x) => x.replace(/^\(/, '').replace(/\)$/, ''));
    const splittedWithNumbers = raw[0].split(':').length >= 3 ? raw[0].split(':') : raw[1].split(':');
    while (splittedWithNumbers.length > 2) splittedWithNumbers.shift();
    stack.push({
      url: raw[1].includes('.') ? raw[raw.length - 2].split(':')[0] : 'native',
      line: +splittedWithNumbers[0] || null,
      column: +splittedWithNumbers[1] || null,
      orig: raw[2], // + '-' + JSON.stringify(splitted),
      //   func: raw[0].includes(':') ? '.' : raw[0], // || !raw[0] ? '.' : raw[0].split('.').length === 2 ? raw[0].split('.')[1] : '?',
      func: raw[0].includes(':') || !raw[0] ? '.' : raw[0].split('.').length === 2 ? raw[0].split('.')[1] : '?',
      class: raw[0].includes(':') || !raw[0] ? '.' : raw[0].split('.').length === 2 ? raw[0].split('.')[0] : '?',
      //   args: [''],
    });
  }
  return {
    name: error.name || 'Unknown',
    message: error.message || '',
    stack: stack.reverse(),
  };
}
