import { Logger } from '@nestjs/common';
import {
  ChannelSender,
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

function claimed(attempts: number): ClaimedDelivery {
  return {
    id: DELIVERY_ID,
    tenantId: 'tenant-a',
    notificationId: 'notification-1',
    eventType: 'account.welcome',
    channel: 'EMAIL',
    destination: 'user@example.test',
    attempts,
    notification: { recipientSubject: null, locale: 'en', variables: { name: 'Lan' } },
  } as unknown as ClaimedDelivery;
}

class FakeRepository {
  readonly settled: DeliveryOutcome[] = [];
  readonly retries: { reason: string; detail: string }[] = [];
  settleFailures = 0;
  private claims = 0;

  claimDue(): Promise<ClaimedDelivery[]> {
    this.claims += 1;
    return Promise.resolve([claimed(this.claims)]);
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
  ): Promise<void> {
    this.retries.push({ reason, detail });
    return Promise.resolve();
  }
}

class FakeSender extends ChannelSender {
  calls = 0;
  failure: Error | null = null;

  send(): Promise<{ providerMessageId: string }> {
    this.calls += 1;
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
        Promise.resolve({ id: 'template-1', version: 1, subject: 'Hi {{name}}', body: 'Body' }),
    } as never,
    { asVariables: () => Promise.resolve({}) } as never,
    {
      isBlocked: () => Promise.resolve(false),
      isOptedOut: () => Promise.resolve(false),
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
      { reason: DeliveryReason.PROVIDER_ERROR, detail: 'Provider answered 503' },
    ]);
  });

  it('nhà cung cấp từ chối khoá thì vẫn thử lại, nhưng ghi lý do cấu hình sai và log mức lỗi', async () => {
    sender.failure = new ProviderConfigurationError('Provider answered 401');
    await dispatcher.dispatchBatch();
    expect(repository.settled).toEqual([]);
    expect(repository.retries).toEqual([
      { reason: DeliveryReason.PROVIDER_MISCONFIGURED, detail: 'Provider answered 401' },
    ]);
    expect(errorLog).toHaveBeenCalled();
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
