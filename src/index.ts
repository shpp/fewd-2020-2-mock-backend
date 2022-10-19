import './utils/source-map-hack-auto';
import { rollbarCaptureError } from './utils/rollbar';
import { handleHttpRequests } from './utils/setup-routing';
import { Router } from 'itty-router';
import { faker } from '@faker-js/faker/locale/en';
import { getState, saveState } from './app/state';
import { State } from './app/types';
import { UserValidator } from './app/validation';
import { CfRequest } from './utils/types';

export default {
  fetch: handleHttpRequests<Env>((router: Router): void => {
    router.get('/:username/users', async (req: CfRequest, env: Env) => {
      const username = req.params.username;
      let state: State | null = await getState(username, env);

      if (!state) {
        state = {
          users: Array.from({ length: 50 }, () => ({
            name: faker.name.firstName(),
            surname: faker.name.lastName(),
            avatar: faker.internet.avatar(),
            birthday: faker.date.past(),
          })).reduce((acc, el, i) => ({ ...acc, [i + 1]: el }), {}),
        };

        await saveState(username, state, env);
      }
      const { users: data = {} } = state;

      return new Response(
        JSON.stringify({
          data: Object.keys(data)
            .filter((x: string) => !data[x].deleted)
            .reduce(
              (acc, key) => ({
                ...acc,
                [key]: data[key],
              }),
              {}
            ),
        })
      );
    });

    router.post('/:username/users', async (req: CfRequest, env: Env) => {
      let data = null;

      try {
        data = UserValidator.parse(await req.json());
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Wrong data' }), { status: 400 });
      }

      const username = req.params.username;
      const state = (await getState(username, env)) || { users: {} };
      const id: number =
        (Object.keys(state.users)
          .map((x) => +x)
          .sort((a, b) => a - b)
          .pop() || 0) + 1;
      state.users = {
        ...state.users,
        [id]: data,
      };

      await saveState(username, state, env);

      return new Response(JSON.stringify({ result: 'Created!' }));
    });

    router.get('/:username/users/:userId', async (req: CfRequest, env: Env) => {
      const username = req.params.username;
      const userId = req.params.userId;
      const state = await getState(username, env);
      const user = state?.users[userId];

      if (!user || user.deleted) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      return new Response(JSON.stringify({ data: user }));
    });

    router.put('/:username/users/:userId', async (req: CfRequest, env: Env) => {
      let data = null;

      try {
        data = UserValidator.parse(await req.json());
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Wrong data' }), { status: 400 });
      }

      const username = req.params.username;
      const userId = req.params.userId;
      const state = await getState(username, env);
      const user = state?.users[userId];

      if (!state || !user || user.deleted) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      state.users[userId] = data;

      await saveState(username, state, env);

      return new Response(JSON.stringify({ result: 'Updated!' }));
    });

    router.delete('/:username/users/:userId', async (req: CfRequest, env: Env) => {
      const username = req.params.username;
      const userId = req.params.userId;
      const state = await getState(username, env);
      const user = state?.users[userId];

      if (!state || !user || user.deleted) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      user.deleted = true;
      state.users[userId] = user;

      await saveState(username, state, env);

      return new Response(JSON.stringify({ result: 'Deleted!' }));
    });

    router.options('*', () => new Response(null));

    router.all('*', () => new Response(JSON.stringify({ error: 'Route not found' }), { status: 404 }));
  }, rollbarCaptureError),
} as ExportedHandler<Env>;

export interface Env {
  REDIS_URL: string;
  REDIS_TOKEN: string;
}
