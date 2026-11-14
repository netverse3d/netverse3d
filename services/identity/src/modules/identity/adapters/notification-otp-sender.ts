import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CommandClient, connectCommands, loadContract, PLATFORM_SCOPE } from '@netverse/nest-kit';
import { AppConfig } from '../../../config/app-config';
import type { SendReply } from '../../../generated/grpc/netverse/notification/v1/SendReply';
import type { SendRequest } from '../../../generated/grpc/netverse/notification/v1/SendRequest';
import { ServiceClientService } from '../../service-clients/services/service-client.service';
import { OtpMessage, OtpSender } from '../ports/otp-sender';

const CONTRACT = 'notification';
const COMMANDS = 'netverse.notification.v1.NotificationCommands';
const SEND_PERMISSION = 'notification:send';
const SEND_TIMEOUT_MS = 5_000;
const TOKEN_REFRESH_MARGIN_MS = 30_000;

export interface IssuedToken {
  value: string;
  expiresAt: number;
}

export interface OwnServiceAccount {
  ensure(): Promise<void>;
  issueToken(): Promise<IssuedToken>;
}

export class NotificationOtpSender
  extends OtpSender
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private token: IssuedToken | null = null;

  constructor(
    private readonly commands: CommandClient,
    private readonly account: OwnServiceAccount,
  ) {
    super();
  }

  onApplicationBootstrap(): Promise<void> {
    return this.account.ensure();
  }

  onModuleDestroy(): void {
    this.commands.close();
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
      this.token = await this.account.issueToken();
    }
    return this.token.value;
  }
}

export function createNotificationOtpSender(
  config: AppConfig,
  serviceClients: ServiceClientService,
): OtpSender {
  const audience = config.otp.notificationAudience;
  return new NotificationOtpSender(
    connectCommands(loadContract(CONTRACT), COMMANDS, config.otp.notificationAddress as string),
    {
      ensure: () => serviceClients.ensureOwnAccount(audience, [SEND_PERMISSION]),
      issueToken: async () => {
        const issued = await serviceClients.issueOwnToken(audience);
        return { value: issued.accessToken, expiresAt: Date.now() + issued.expiresIn * 1000 };
      },
    },
  );
}
