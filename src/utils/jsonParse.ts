export function tryJsonParse<T>(a: string | undefined | null): T | undefined {
  try {
    return JSON.parse(a || 'dsf');
  } catch (_) {
    return undefined;
  }
}
