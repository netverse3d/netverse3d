export interface OutboundEvent {
  id: string;
  type: string;
  aggregateId: string;
  tenantId: string | null;
  occurredAt: string;
  data: unknown;
}

export abstract class EventPublisher {
  abstract publish(event: OutboundEvent): Promise<void>;
}
