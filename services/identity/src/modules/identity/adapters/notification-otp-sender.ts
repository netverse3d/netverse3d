import { randomUUID } from 'node:crypto';
import { CommandClient, connectCommands, loadContract, PLATFORM_SCOPE } from '@netverse/nest-kit';
import { AppConfig } from '../../../config/app-config';
import type { SendReply } from '../../../generated/grpc/netverse/notification/v1/SendReply';
import type { SendRequest } from '../../../generated/grpc/netverse/notification/v1/SendRequest';
import { KeysService } from '../../keys/services/keys.service';
import { OtpMessage, OtpSender } from '../ports/otp-sender';

const CONTRACT = 'notification';
const COMMANDS = 'netverse.notification.v1.NotificationCommands';
const AUDIENCE = 'notification';
const SEND_PERMISSION = 'notification:send';
const SERVICE_NAME = 'identity';
const SEND_TIMEOUT_MS = 5_000;
const TOKEN_TTL_SECONDS = 300;
const TOKEN_REFRESH_MARGIN_MS = 30_000;

export interface IssuedToken {
  value: string;
  expiresAt: number;
}

export class NotificationOtpSender extends OtpSender {
  private token: IssuedToken | null = null;

  constructor(
    private readonly commands: CommandClient,
    private readonly issueToken: () => Promise<IssuedToken>,
  ) {
    super();
  }

  async send(message: OtpMessage): Promise<void> {
    const request: SendRequest = {
      scope: PLATFORM_SCOPE,
      eventType: `identity.otp.${message.purpose.toLowerCase()}`,
      recipient: { email: message.email },
      variablesJson: JSON.stringify({
        code: message.code,
        expiresInMinutes: message.expiresInMinutes,
      }),
      channels: ['CHANNEL_EMAIL'],
      expiresAt: message.expiresAt.toISOString(),
    };
    await this.commands.call<SendReply>('Send', request, {
      token: await this.accessToken(),
      idempotencyKey: randomUUID(),
      timeoutMs: SEND_TIMEOUT_MS,
    });
  }

  private async accessToken(): Promise<string> {
    if (!this.token || this.token.expiresAt - TOKEN_REFRESH_MARGIN_MS <= Date.now()) {
      this.token = await this.issueToken();
    }
    return this.token.value;
  }
}

export function createNotificationOtpSender(config: AppConfig, keys: KeysService): OtpSender {
  return new NotificationOtpSender(
    connectCommands(loadContract(CONTRACT), COMMANDS, config.otp.notificationAddress as string),
    async () => ({
      value: await keys.sign(
        { client_id: SERVICE_NAME, permissions: [SEND_PERMISSION] },
        `service:${SERVICE_NAME}`,
        { audience: AUDIENCE, ttlSeconds: TOKEN_TTL_SECONDS },
      ),
      expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    }),
  );
}
