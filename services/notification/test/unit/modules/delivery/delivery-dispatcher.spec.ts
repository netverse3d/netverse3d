import { Logger } from '@nestjs/common';
import {
  ChannelSender,
  OutboundMessage,
  PermanentSendError,
  ProviderConfigurationError,
} from '../../../../src/modules/channels/ports/channel-sender';
import { DeliveryDispatcherService } from '../../../../src/modules/delivery/services/delivery-dispatcher.service';
import {
  ClaimedDelivery,
  DeliveryOutcome,
} from '../../../../src/modules/delivery/repositories/delivery.repository';
import { DeliveryReason } from '../../../../src/modules/notifications/domain/delivery-reasons';

const DELIVERY_ID = 'delivery-1';

const world = {
  tenantId: 'tenant-a',
  recipientSubject: null as string | null,
  expiresAt: null as Date | null,
  category: 'TRANSACTIONAL',
  brand: {} as Record<string, string>,
  optedOut: false,
};

function claimed(attempts: number, createdAt: Date): ClaimedDelivery {
  return {
    id: DELIVERY_ID,
    tenantId: world.tenantId,
    notificationId: 'notification-1',
    eventType: 'account.welcome',
    channel: 'EMAIL',
    destination: 'user@example.test',
    attempts,
    createdAt,
    notification: {
      recipientSubject: world.recipientSubject,
      expiresAt: world.expiresAt,
      locale: 'en',
      variables: { name: 'Lan' },
    },
  } as unknown as ClaimedDelivery;
}

class FakeRepository {
  readonly settled: DeliveryOutcome[] = [];
  readonly retries: { reason: string; detail: string; countAttempt: boolean }[] = [];
  settleFailures = 0;
  createdAt = new Date();
  claims = 0;

  claimDue(): Promise<ClaimedDelivery[]> {
    this.claims += 1;
    return Promise.resolve([claimed(this.claims, this.createdAt)]);
  }

  settle(_delivery: ClaimedDelivery, outcome: DeliveryOutcome): Promise<void> {
    if (this.settleFailures > 0) {
      this.settleFailures -= 1;
      return Promise.reject(new Error('database is unavailable'));
    }
    this.settled.push(outcome);
    return Promise.resolve();
  }

  scheduleRetry(
    _delivery: ClaimedDelivery,
    _nextAttemptAt: Date,
    reason: string,
    detail: string,
    countAttempt = true,
  ): Promise<void> {
    this.retries.push({ reason, detail, countAttempt });
    return Promise.resolve();
  }
}

class FakeSender extends ChannelSender {
  calls = 0;
  failure: Error | null = null;
  last: OutboundMessage | null = null;

  send(message: OutboundMessage): Promise<{ providerMessageId: string }> {
    this.calls += 1;
    this.last = message;
    return this.failure
      ? Promise.reject(this.failure)
      : Promise.resolve({ providerMessageId: `provider-${this.calls}` });
  }
}

function dispatcherWith(repository: FakeRepository, sender: FakeSender) {
  return new DeliveryDispatcherService(
    {
      delivery: {
        batchSize: 10,
        concurrency: 5,
        leaseMs: 60_000,
        maxAttempts: 6,
        retryBaseMs: 1_000,
        retryMaxMs: 60_000,
      },
    } as never,
    repository as never,
    { senderFor: () => sender } as never,
    {
      resolve: () =>
        Promise.resolve({
          id: 'template-1',
          version: 1,
          category: world.category,
          subject: 'Hi {{name}}',
          body: 'Body',
        }),
    } as never,
    { asVariables: () => Promise.resolve(world.brand) } as never,
    {
      isBlocked: () => Promise.resolve(false),
      isOptedOut: () => Promise.resolve(world.optedOut),
    } as never,
  );
}

describe('bộ phát lần gửi', () => {
  let repository: FakeRepository;
  let sender: FakeSender;
  let dispatcher: DeliveryDispatcherService;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    Object.assign(world, {
      tenantId: 'tenant-a',
      recipientSubject: null,
      expiresAt: null,
      category: 'TRANSACTIONAL',
      brand: {},
      optedOut: false,
    });
    repository = new FakeRepository();
    sender = new FakeSender();
    dispatcher = dispatcherWith(repository, sender);
  });

  afterEach(() => jest.restoreAllMocks());

  it('thư đã được nhận mà ghi kết quả lỗi một lần thì ghi lại, không gửi lại', async () => {
    repository.settleFailures = 1;
    await dispatcher.dispatchBatch();
    expect(sender.calls).toBe(1);
    expect(repository.retries).toEqual([]);
    expect(repository.settled).toMatchObject([{ status: 'SENT', providerMessageId: 'provider-1' }]);
  });

  it('ghi kết quả lỗi mãi thì giữ kết quả, lần nhận việc sau chỉ ghi chứ không gửi lại', async () => {
    repository.settleFailures = 100;
    await dispatcher.dispatchBatch();
    expect(repository.retries).toEqual([]);
    expect(repository.settled).toEqual([]);
    expect(errorLog).toHaveBeenCalled();

    repository.settleFailures = 0;
    await dispatcher.dispatchBatch();
    expect(sender.calls).toBe(1);
    expect(repository.settled).toMatchObject([{ status: 'SENT', providerMessageId: 'provider-1' }]);

    await dispatcher.dispatchBatch();
    expect(sender.calls).toBe(2);
  });

  it('nhà cung cấp trục trặc tạm thời thì hẹn thử lại với lý do lỗi nhà cung cấp', async () => {
    sender.failure = new Error('Provider answered 503');
    await dispatcher.dispatchBatch();
    expect(repository.settled).toEqual([]);
    expect(repository.retries).toEqual([
      {
        reason: DeliveryReason.PROVIDER_ERROR,
        detail: 'Provider answered 503',
        countAttempt: true,
      },
    ]);
  });

  it('lần thử cuối vẫn lỗi tạm thời thì chôn với lý do hết số lần thử', async () => {
    sender.failure = new Error('Provider answered 503');
    repository.claims = 5;
    await dispatcher.dispatchBatch();
    expect(repository.retries).toEqual([]);
    expect(repository.settled).toMatchObject([
      { status: 'DEAD', reason: DeliveryReason.MAX_ATTEMPTS_EXCEEDED },
    ]);
  });

  it('cấu hình sai không ăn vào số lần thử: quá số lần thử vẫn chờ tiếp chứ không chôn', async () => {
    sender.failure = new ProviderConfigurationError('Provider answered 401');
    repository.claims = 5;
    await dispatcher.dispatchBatch();
    expect(repository.settled).toEqual([]);
    expect(repository.retries).toMatchObject([
      { reason: DeliveryReason.PROVIDER_MISCONFIGURED, countAttempt: false },
    ]);
  });

  it('cấu hình sai kéo dài quá một ngày thì chôn, giữ đúng lý do cấu hình sai', async () => {
    sender.failure = new ProviderConfigurationError('Provider answered 401');
    repository.createdAt = new Date(Date.now() - 25 * 3_600_000);
    await dispatcher.dispatchBatch();
    expect(repository.retries).toEqual([]);
    expect(repository.settled).toMatchObject([
      { status: 'DEAD', reason: DeliveryReason.PROVIDER_MISCONFIGURED },
    ]);
    expect(errorLog).toHaveBeenCalled();
  });

  it('nhà cung cấp từ chối khoá thì vẫn thử lại, nhưng ghi lý do cấu hình sai và log mức lỗi', async () => {
    sender.failure = new ProviderConfigurationError('Provider answered 401');
    await dispatcher.dispatchBatch();
    expect(repository.settled).toEqual([]);
    expect(repository.retries).toEqual([
      {
        reason: DeliveryReason.PROVIDER_MISCONFIGURED,
        detail: 'Provider answered 401',
        countAttempt: false,
      },
    ]);
    expect(errorLog).toHaveBeenCalled();
  });

  it('thư tuỳ chọn tôn trọng lựa chọn tắt nhận, thư giao dịch thì luôn gửi', async () => {
    world.recipientSubject = 'user-1';
    world.optedOut = true;
    world.category = 'OPTIONAL';
    await dispatcher.dispatchBatch();
    expect(sender.calls).toBe(0);
    expect(repository.settled).toMatchObject([
      { status: 'SKIPPED', reason: DeliveryReason.OPTED_OUT },
    ]);

    world.category = 'TRANSACTIONAL';
    await dispatcher.dispatchBatch();
    expect(sender.calls).toBe(1);
  });

  it('thư tuỳ chọn không có mã người nhận thì bị loại, vì không xét được lựa chọn tắt nhận', async () => {
    world.category = 'OPTIONAL';
    await dispatcher.dispatchBatch();
    expect(sender.calls).toBe(0);
    expect(repository.settled).toMatchObject([
      { status: 'DEAD', reason: DeliveryReason.RECIPIENT_SUBJECT_MISSING },
    ]);
  });

  it('thông báo quá hạn thì bị loại chứ không gửi muộn', async () => {
    world.expiresAt = new Date(Date.now() - 1_000);
    await dispatcher.dispatchBatch();
    expect(sender.calls).toBe(0);
    expect(repository.settled).toMatchObject([{ status: 'DEAD', reason: DeliveryReason.EXPIRED }]);
  });

  it('thông báo còn hạn vẫn được gửi', async () => {
    world.expiresAt = new Date(Date.now() + 60_000);
    await dispatcher.dispatchBatch();
    expect(sender.calls).toBe(1);
  });

  it('khoá bị từ chối mà thông báo đã quá hạn thì loại với lý do quá hạn', async () => {
    sender.failure = new ProviderConfigurationError('Provider answered 401');
    world.expiresAt = new Date(Date.now() + 40);
    await dispatcher.dispatchBatch();
    expect(repository.retries).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await dispatcher.dispatchBatch();
    expect(repository.settled).toMatchObject([{ status: 'DEAD', reason: DeliveryReason.EXPIRED }]);
  });

  it('email của tiệm mang tên thương hiệu của tiệm, đã bỏ ký tự phá header', async () => {
    world.brand = { name: 'Lan "Net" <x>\r\nBcc: a@b.test' };
    await dispatcher.dispatchBatch();
    expect(sender.last?.senderName).toBe('Lan Net xBcc: a@b.test');
  });

  it('tiệm chưa đặt tên và phạm vi nền tảng dùng tên chung của hệ thống', async () => {
    await dispatcher.dispatchBatch();
    expect(sender.last?.senderName).toBeUndefined();

    world.tenantId = 'platform';
    world.brand = { name: 'Netverse Shop' };
    await dispatcher.dispatchBatch();
    expect(sender.last?.senderName).toBeUndefined();
  });

  it('nhà cung cấp từ chối chính bức thư thì chôn, không thử lại', async () => {
    sender.failure = new PermanentSendError(DeliveryReason.PROVIDER_REJECTED, 'rejected');
    await dispatcher.dispatchBatch();
    expect(repository.retries).toEqual([]);
    expect(repository.settled).toMatchObject([
      { status: 'DEAD', reason: DeliveryReason.PROVIDER_REJECTED },
    ]);
  });
});
