export type EventPayloadHandler = (payload: Buffer) => Promise<void>;

export class InvalidEventError extends Error {}

export abstract class EventConsumer {
  abstract start(handler: EventPayloadHandler): Promise<void>;
  abstract stop(): Promise<void>;
  abstract isHealthy(): boolean;
}
