import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

const ACCEPTED_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;
const MAX_USER_AGENT_LENGTH = 512;

export type IdentifiedRequest = Request & { id: string };

function resolveRequestId(inbound: string | undefined): string {
  return inbound && ACCEPTED_REQUEST_ID.test(inbound) ? inbound : randomUUID();
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req.header(REQUEST_ID_HEADER));
  (req as IdentifiedRequest).id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  runWithRequestContext(
    {
      requestId,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
      actor: null,
    },
    next,
  );
}
