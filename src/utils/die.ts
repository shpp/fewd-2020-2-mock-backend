export function die<T>(error: string): NonNullable<T> {
  throw new Error(error);
}
export function expected<T>(v: T | undefined | null): NonNullable<T> {
  if (v === null || v === undefined) {
    throw new Error('null or undefined value');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return v as any;
}
