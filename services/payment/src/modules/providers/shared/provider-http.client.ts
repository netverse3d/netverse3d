import { fetchWithTimeout, isTimeoutError } from '@app/common/utils/http.util';

export type ProviderTransportErrorKind = 'timeout' | 'network' | 'http' | 'invalid_json';

export class ProviderTransportError extends Error {
  constructor(
    message: string,
    public readonly kind: ProviderTransportErrorKind,
    public readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = 'ProviderTransportError';
  }
}

export interface ProviderHttpRequest {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ProviderHttpResponse {
  status: number;
  body: unknown;
}

export async function providerRequestJson(
  url: string,
  request: ProviderHttpRequest,
  timeoutMs: number,
): Promise<ProviderHttpResponse> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: request.method,
        headers: {
          accept: 'application/json',
          ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...request.headers,
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
      },
      timeoutMs,
    );
  } catch (error) {
    if (isTimeoutError(error))
      throw new ProviderTransportError(
        `Provider request timed out after ${timeoutMs}ms`,
        'timeout',
      );
    throw new ProviderTransportError(
      `Provider request failed: ${error instanceof Error ? error.message : String(error)}`,
      'network',
    );
  }

  const text = await response.text().catch(() => '');
  if (response.status >= 500) {
    throw new ProviderTransportError(
      `Provider responded HTTP ${response.status}`,
      'http',
      response.status,
    );
  }
  if (!text) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    throw new ProviderTransportError(
      `Provider responded HTTP ${response.status} with a non-JSON body`,
      'invalid_json',
      response.status,
    );
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringField(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}
