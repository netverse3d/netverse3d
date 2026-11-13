import { EventConsumer } from '../ports/event-consumer';

export class NoneEventConsumer extends EventConsumer {
  start(): Promise<void> {
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  isHealthy(): boolean {
    return true;
  }
}
