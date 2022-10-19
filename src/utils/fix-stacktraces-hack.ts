/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

export function rethrowErrors<T extends (...args: any[]) => any>(object: any, method: T): T {
  return (async (...params: any[]) => {
    try {
      return await method.bind(object)(...params);
    } catch (e) {
      throw new Error('' + e);
    }
  }) as any as T;
}
