import { KitConfig } from '../../../../../src/config/kit-config';
import { Database } from '../../../../../src/infrastructure/database/database';
import { EventContracts } from '../../../../../src/modules/outbox/domain/event-contracts';
import { EventEnvelope } from '../../../../../src/modules/outbox/domain/event-envelope';
import { EventPublisher } from '../../../../../src/modules/outbox/ports/event-publisher';
import {
  OutboxRepository,
  OutboxRow,
} from '../../../../../src/modules/outbox/repositories/outbox.repository';
import { OutboxRelayJob } from '../../../../../src/modules/outbox/services/outbox-relay.job';

const PRINCIPAL = '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b';

function row(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    type: 'user.registered',
    tenantId: null,
    createdAt: new Date('2026-11-13T08:00:00.000Z'),
    payload: { principalId: PRINCIPAL, email: 'a@example.test', status: 'ACTIVE' },
    attempts: 0,
    ...overrides,
  } as OutboxRow;
}

class RecordingPublisher extends EventPublisher {
  readonly published: EventEnvelope[] = [];
  failure: Error | null = null;

  publish(event: EventEnvelope): Promise<void> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    this.published.push(event);
    return Promise.resolve();
  }
}

function subject(rows: OutboxRow[], maxAttempts = 3) {
  const publisher = new RecordingPublisher();
  const failed: Array<{ id: string; attempts: number; nextAttemptAt: Date | null; error: string }> =
    [];
  const publishedIds: string[] = [];
  const repository = {
    findDue: () => Promise.resolve(rows),
    markPublished: (id: string) => {
      publishedIds.push(id);
      return Promise.resolve();
    },
    markFailed: (id: string, attempts: number, nextAttemptAt: Date | null, error: string) => {
      failed.push({ id, attempts, nextAttemptAt, error });
      return Promise.resolve();
    },
  } as unknown as OutboxRepository;
  const config = {
    service: { name: 'identity' },
    jobs: { enabled: false, outboxRelayIntervalMs: 1000, outboxMaxAttempts: maxAttempts },
  } as unknown as KitConfig;
  const job = new OutboxRelayJob(
    {} as Database,
    config,
    repository,
    publisher,
    EventContracts.forService('identity'),
  );
  const relay = () => (job as unknown as { work(): Promise<number> }).work();
  return { relay, publisher, failed, publishedIds };
}

describe('job chuyển outbox', () => {
  it('sự kiện đúng hợp đồng được phát theo vỏ chung rồi đánh dấu đã phát', async () => {
    const { relay, publisher, publishedIds } = subject([row()]);
    await relay();
    expect(publisher.published[0]).toMatchObject({ type: 'user.registered', source: 'identity' });
    expect(publishedIds).toEqual(['11111111-2222-4333-8444-555555555555']);
  });

  it('sự kiện sai hợp đồng không được phát và bị chôn ngay, không chờ thử lại', async () => {
    const { relay, publisher, failed, publishedIds } = subject([row({ type: 'user.renamed' })]);
    await relay();
    expect(publisher.published).toHaveLength(0);
    expect(publishedIds).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.nextAttemptAt).toBeNull();
    expect(failed[0]?.error).toContain('user.renamed is not declared');
  });

  it('broker lỗi thì sự kiện được hẹn thử lại, chưa bị chôn', async () => {
    const { relay, publisher, failed } = subject([row()]);
    publisher.failure = new Error('broker unavailable');
    await relay();
    expect(failed[0]).toMatchObject({ attempts: 1, error: 'broker unavailable' });
    expect(failed[0]?.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('hết số lần thử thì sự kiện bị chôn', async () => {
    const { relay, publisher, failed } = subject([row({ attempts: 2 })], 3);
    publisher.failure = new Error('broker unavailable');
    await relay();
    expect(failed[0]).toMatchObject({ attempts: 3, nextAttemptAt: null });
  });

  it('một sự kiện hỏng không chặn sự kiện đứng sau', async () => {
    const good = row({ id: '22222222-2222-4333-8444-555555555555' });
    const { relay, publisher } = subject([row({ type: 'user.renamed' }), good]);
    await relay();
    expect(publisher.published.map((event) => event.id)).toEqual([good.id]);
  });
});
