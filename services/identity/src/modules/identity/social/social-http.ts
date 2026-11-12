const PROVIDER_TIMEOUT_MS = 8_000;

export async function fetchProviderJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: T }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  if (response.status >= 500) {
    throw new Error(`provider answered ${response.status}`);
  }
  return { ok: response.ok, status: response.status, body: (await response.json()) as T };
}
