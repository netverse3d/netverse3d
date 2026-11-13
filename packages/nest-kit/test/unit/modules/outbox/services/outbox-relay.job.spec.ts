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
const FIRST = '11111111-2222-4333-8444-555555555555';
const SECOND = '22222222-2222-4333-8444-555555555555';
const THIRD = '33333333-2222-4333-8444-555555555555';

function row(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: FIRST,
    type: 'user.registered',
    tenantId: null,
    createdAt: new Date('2026-11-13T08:00:00.000Z'),
    nextAttemptAt: new Date(Date.now() - 1_000),
    payload: { principalId: PRINCIPAL, email: 'a@example.test', status: 'ACTIVE' },
    attempts: 0,
    ...overrides,
  } as OutboxRow;
}

class RecordingPublisher extends EventPublisher {
  readonly published: EventEnvelope[] = [];
  failingIds = new Set<string>();

  publish(event: EventEnvelope): Promise<void> {
    if (this.failingIds.has(event.id)) {
      return Promise.reject(new Error('broker unavailable'));
    }
    this.published.push(event);
    return Promise.resolve();
  }
}

interface Failure {
  id: string;
  attempts: number;
  nextAttemptAt: Date | null;
  error: string;
}

function subject(rows: OutboxRow[], maxAttempts = 3) {
  const publisher = new RecordingPublisher();
  const failed: Failure[] = [];
  const publishedIds: string[] = [];
  const repository = {
    findPendingInOrder: () => Promise.resolve(rows),
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
    expect(publishedIds).toEqual([FIRST]);
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

  it('sự kiện sai hợp đồng không chặn sự kiện đứng sau', async () => {
    const { relay, publisher } = subject([row({ type: 'user.renamed' }), row({ id: SECOND })]);
    await relay();
    expect(publisher.published.map((event) => event.id)).toEqual([SECOND]);
  });

  it('broker lỗi thì sự kiện được hẹn thử lại và lượt chạy dừng, để sự kiện sau không vượt lên trước', async () => {
    const { relay, publisher, failed, publishedIds } = subject([
      row(),
      row({ id: SECOND }),
      row({ id: THIRD }),
    ]);
    publisher.failingIds = new Set([SECOND]);
    await relay();
    expect(publishedIds).toEqual([FIRST]);
    expect(publisher.published.map((event) => event.id)).toEqual([FIRST]);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ id: SECOND, attempts: 1, error: 'broker unavailable' });
    expect(failed[0]?.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('sự kiện đứng đầu chưa tới giờ thử lại thì cả hàng chờ, không phát sự kiện sau', async () => {
    const waiting = row({ attempts: 2, nextAttemptAt: new Date(Date.now() + 60_000) });
    const { relay, publisher, failed } = subject([waiting, row({ id: SECOND })]);
    expect(await relay()).toBe(0);
    expect(publisher.published).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it('broker lỗi bao nhiêu lần sự kiện cũng không bị chôn, kể cả vượt số lần thử cấu hình', async () => {
    const { relay, publisher, failed } = subject([row({ attempts: 40 })], 3);
    publisher.failingIds = new Set([FIRST]);
    await relay();
    expect(failed[0]?.attempts).toBe(41);
    expect(failed[0]?.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('khoảng chờ thử lại tăng dần nhưng không quá mười lăm phút', async () => {
    const { relay, publisher, failed } = subject([row({ attempts: 40 })]);
    publisher.failingIds = new Set([FIRST]);
    const before = Date.now();
    await relay();
    const delay = (failed[0]?.nextAttemptAt as Date).getTime() - before;
    expect(delay).toBeGreaterThan(14 * 60_000);
    expect(delay).toBeLessThanOrEqual(15 * 60_000 + 1_000);
  });
});
