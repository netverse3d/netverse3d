import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import type { IdentifiedRequest } from '../../common/context/request-context.middleware';
import { KitConfig } from '../../config/kit-config';

export const REDACTED_LOG_PATHS = [
  'password',
  'token',
  'secret',
  'authorization',
  '*.password',
  '*.token',
  '*.secret',
  '*.authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
];

const PROBE_PATHS = new Set(['/healthz', '/livez']);

function pathOf(url: string | undefined): string {
  return (url ?? '').split('?')[0] ?? '';
}

function levelForStatus(
  _req: IncomingMessage,
  res: ServerResponse,
  error: Error | undefined,
): 'error' | 'warn' | 'info' {
  if (error || res.statusCode >= 500) {
    return 'error';
  }
  return res.statusCode >= 400 ? 'warn' : 'info';
}

export function buildPinoHttpOptions(config: KitConfig): Options {
  return {
    level: config.log.level,
    base: { service: config.service.name, version: config.service.version },
    genReqId: (req) => (req as unknown as IdentifiedRequest).id,
    redact: { paths: REDACTED_LOG_PATHS, censor: '[REDACTED]' },
    customLogLevel: levelForStatus,
    autoLogging: { ignore: (req) => PROBE_PATHS.has(pathOf(req.url)) },
    serializers: {
      req: (req: { id: string; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        path: pathOf(req.url),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    transport: config.log.pretty
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
  };
}
