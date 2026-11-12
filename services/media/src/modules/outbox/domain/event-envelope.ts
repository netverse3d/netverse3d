export const EVENT_VERSION = 1;

export interface EventEnvelope {
  id: string;
  type: string;
  source: string;
  occurredAt: string;
  version: number;
  data: Record<string, unknown>;
}

export interface StoredEvent {
  id: string;
  type: string;
  tenantId: string | null;
  createdAt: Date;
  payload: unknown;
}

export function toEnvelope(event: StoredEvent, source: string): EventEnvelope {
  return {
    id: event.id,
    type: event.type,
    source,
    occurredAt: event.createdAt.toISOString(),
    version: EVENT_VERSION,
    data: { ...(event.payload as Record<string, unknown>), tenantId: event.tenantId },
  };
}
