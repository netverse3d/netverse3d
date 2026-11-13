import {
  ChannelSender,
  OutboundMessage,
  PermanentSendError,
} from '../../../../../src/modules/channels/ports/channel-sender';

export const EMAIL_MESSAGE: OutboundMessage = {
  deliveryId: '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b',
  tenantId: 'tenant-a',
  eventType: 'account.welcome',
  channel: 'EMAIL',
  destination: 'user@example.test',
  subject: 'Subject',
  body: '<p>Body</p>',
};

export const SENDER_CONTEXT = {
  fromAddress: 'from@example.test',
  fromName: 'Sender',
  timeoutMs: 5_000,
};

export interface EmailSenderSimulation {
  provider: string;
  secrets: string[];
  sender(): ChannelSender;
  accept(messageId: string): void;
  rejectMessage(): void;
  failTemporarily(): void;
  beUnreachable(): void;
}

export function describeEmailSenderContract(simulation: EmailSenderSimulation): void {
  describe(`luật chung của bộ gửi email: ${simulation.provider}`, () => {
    afterEach(() => jest.restoreAllMocks());

    it('thư được nhận thì trả mã thư của nhà cung cấp', async () => {
      simulation.accept('provider-message-1');
      await expect(simulation.sender().send(EMAIL_MESSAGE)).resolves.toEqual({
        providerMessageId: 'provider-message-1',
      });
    });

    it('nhà cung cấp từ chối chính bức thư là lỗi vĩnh viễn, không thử lại', async () => {
      simulation.rejectMessage();
      await expect(simulation.sender().send(EMAIL_MESSAGE)).rejects.toBeInstanceOf(
        PermanentSendError,
      );
    });

    it('nhà cung cấp trục trặc tạm thời là lỗi thường, để lần gửi được thử lại', async () => {
      simulation.failTemporarily();
      const attempt = simulation.sender().send(EMAIL_MESSAGE);
      await expect(attempt).rejects.toBeInstanceOf(Error);
      await expect(attempt).rejects.not.toBeInstanceOf(PermanentSendError);
    });

    it('không nối được tới nhà cung cấp cũng là lỗi tạm thời', async () => {
      simulation.beUnreachable();
      const attempt = simulation.sender().send(EMAIL_MESSAGE);
      await expect(attempt).rejects.not.toBeInstanceOf(PermanentSendError);
    });

    it('bí mật của nhà cung cấp không lọt vào thông báo lỗi', async () => {
      for (const fail of [
        simulation.rejectMessage,
        simulation.failTemporarily,
        simulation.beUnreachable,
      ]) {
        fail();
        const error: unknown = await simulation
          .sender()
          .send(EMAIL_MESSAGE)
          .catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(Error);
        const { message, cause, stack } = error as Error;
        for (const secret of simulation.secrets) {
          expect(`${message} ${String(cause ?? '')} ${stack ?? ''}`).not.toContain(secret);
        }
      }
    });
  });
}
