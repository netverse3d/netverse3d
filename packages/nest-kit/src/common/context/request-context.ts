import { AsyncLocalStorage } from 'node:async_hooks';

export interface Actor {
  subject: string;
  tenantId: string | null;
  roles: readonly string[];
  sessionId?: string;
  tokenVersion?: number;
}

export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  actor: Actor | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext(context: RequestContext, callback: () => void): void {
  storage.run(context, callback);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function currentRequestId(): string | null {
  return storage.getStore()?.requestId ?? null;
}

export function currentActor(): Actor | null {
  return storage.getStore()?.actor ?? null;
}

export function assignActor(actor: Actor): void {
  const context = storage.getStore();
  if (context) {
    context.actor = actor;
  }
}
