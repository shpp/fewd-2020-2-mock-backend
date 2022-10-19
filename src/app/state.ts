/**
 * Upstash Redis DB
 */

import { Env } from '../index';
import { State } from './types';

export async function getState(token: string, env: Env): Promise<State | null> {
  const response = await fetch(env.REDIS_URL + '/get/' + token, {
    method: 'GET',
    headers: {
      authorization: 'Bearer ' + env.REDIS_TOKEN,
    },
  });

  const data: { result: any } = await response.json();

  if (!data.result) {
    return null;
  }

  return JSON.parse(data.result);
}

export async function saveState(token: string, state: State, env: Env): Promise<void> {
  await fetch(env.REDIS_URL + '/set/' + token, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + env.REDIS_TOKEN,
      'content-type': 'application/json',
    },
    body: JSON.stringify(state),
  });
}
