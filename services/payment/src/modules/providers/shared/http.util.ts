export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

export function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
