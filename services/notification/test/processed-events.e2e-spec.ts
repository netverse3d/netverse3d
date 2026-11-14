import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { ProcessedEventsRepository } from '../src/modules/events/repositories/processed-events.repository';
import { createTestApp, TestApp } from './support/test-app';

describe('mã sự kiện đã xử lý', () => {
  let subject: TestApp;
  let processed: ProcessedEventsRepository;

  beforeAll(async () => {
    subject = await createTestApp();
    processed = subject.app.get(ProcessedEventsRepository);
  });

  afterAll(() => subject.close());

  it('sự kiện chưa gặp thì chưa được ghi nhận', async () => {
    await expect(processed.has(randomUUID())).resolves.toBe(false);
  });

  it('ghi nhận rồi thì lần sau nhận ra, kể cả với một kho dựng lại sau lúc khởi động', async () => {
    const eventId = randomUUID();
    await processed.mark(eventId);
    await expect(processed.has(eventId)).resolves.toBe(true);

    const afterRestart = new ProcessedEventsRepository(subject.app.get(PrismaService));
    await expect(afterRestart.has(eventId)).resolves.toBe(true);
  });

  it('ghi nhận cùng một mã hai lần, kể cả cùng lúc, không gây lỗi', async () => {
    const eventId = randomUUID();
    await Promise.all([processed.mark(eventId), processed.mark(eventId)]);
    await processed.mark(eventId);
    const rows = await subject.app.get(PrismaService).processedEvent.count({ where: { eventId } });
    expect(rows).toBe(1);
  });
});
