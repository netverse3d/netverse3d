import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { AppConfig } from '../../../config/app-config';
import { ServiceClientService } from '../../service-clients/services/service-client.service';
import { OtpMessage, OtpSender } from '../ports/otp-sender';
import { createNotificationOtpSender } from './notification-otp-sender';

const WEBHOOK_TIMEOUT_MS = 5_000;

@Injectable()
export class LogOtpSender extends OtpSender {
  private readonly logger = new Logger(LogOtpSender.name);

  send(message: OtpMessage): Promise<void> {
    this.logger.log(`one-time code for ${message.email} (${message.purpose}): ${message.code}`);
    return Promise.resolve();
  }
}

@Injectable()
export class WebhookOtpSender extends OtpSender {
  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(message: OtpMessage): Promise<void> {
    const body = JSON.stringify(message);
    const signature = createHmac('sha256', this.config.otp.webhookSecret as string)
      .update(body)
      .digest('hex');
    const response = await fetch(this.config.otp.webhookUrl as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature-sha256': signature },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`otp webhook answered ${response.status}`);
    }
  }
}

export function createOtpSender(
  config: AppConfig,
  serviceClients: ServiceClientService,
): OtpSender {
  switch (config.otp.delivery) {
    case 'notification':
      return createNotificationOtpSender(config, serviceClients);
    case 'webhook':
      return new WebhookOtpSender(config);
    case 'log':
      return new LogOtpSender();
  }
}
