export function isLocalDev(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return !!globalThis.MINIFLARE;
  } catch (e) {
    return false;
  }
}
