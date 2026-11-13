import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { BrandingService } from '../../branding/services/branding.service';
import {
  OutboundMessage,
  PermanentSendError,
  ProviderConfigurationError,
} from '../../channels/ports/channel-sender';
import { ChannelRegistry } from '../../channels/services/channel-registry';
import { DeliveryReason } from '../../notifications/domain/delivery-reasons';
import {
  MAX_RENDERED_BODY_LENGTH,
  MAX_RENDERED_SUBJECT_LENGTH,
} from '../../notifications/domain/limits';
import { PreferencesService } from '../../preferences/services/preferences.service';
import { renderTemplate, TemplateRenderError } from '../../templates/domain/template-engine';
import { TemplatesService } from '../../templates/services/templates.service';
import {
  ClaimedDelivery,
  DeliveryOutcome,
  DeliveryRepository,
} from '../repositories/delivery.repository';

const SETTLE_ATTEMPTS = 3;
const SETTLE_RETRY_MS = 100;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function deliveryRetryDelayMs(attempts: number, baseMs: number, maxMs: number): number {
  return Math.min(baseMs * 2 ** (attempts - 1), maxMs);
}

@Injectable()
export class DeliveryDispatcherService {
  private readonly logger = new Logger(DeliveryDispatcherService.name);
  private readonly unrecorded = new Map<string, DeliveryOutcome>();

  constructor(
    private readonly config: AppConfig,
    private readonly repository: DeliveryRepository,
    private readonly registry: ChannelRegistry,
    private readonly templates: TemplatesService,
    private readonly branding: BrandingService,
    private readonly preferences: PreferencesService,
  ) {}

  async dispatchBatch(): Promise<number> {
    const { batchSize, concurrency, leaseMs } = this.config.delivery;
    const batch = await this.repository.claimDue(batchSize, leaseMs);
    for (let start = 0; start < batch.length; start += concurrency) {
      await Promise.all(
        batch.slice(start, start + concurrency).map((delivery) => this.process(delivery)),
      );
    }
    return batch.length;
  }

  private async process(delivery: ClaimedDelivery): Promise<void> {
    const outcome = this.unrecorded.get(delivery.id) ?? (await this.outcomeOf(delivery));
    if (outcome) {
      await this.record(delivery, outcome);
    }
  }

  private async outcomeOf(delivery: ClaimedDelivery): Promise<DeliveryOutcome | null> {
    try {
      return await this.attempt(delivery);
    } catch (error) {
      await this.retryOrBury(delivery, error).catch((failure: unknown) =>
        this.logger.error(`delivery ${delivery.id} could not be updated: ${errorText(failure)}`),
      );
      return null;
    }
  }

  private async record(delivery: ClaimedDelivery, outcome: DeliveryOutcome): Promise<void> {
    for (let attempt = 1; attempt <= SETTLE_ATTEMPTS; attempt += 1) {
      try {
        await this.repository.settle(delivery, outcome);
        this.unrecorded.delete(delivery.id);
        return;
      } catch (error) {
        if (attempt === SETTLE_ATTEMPTS) {
          this.unrecorded.set(delivery.id, outcome);
          this.logger.error(
            `delivery ${delivery.id} ended as ${outcome.status} but the result could not be recorded: ${errorText(error)}`,
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, SETTLE_RETRY_MS * attempt));
      }
    }
  }

  private async attempt(delivery: ClaimedDelivery): Promise<DeliveryOutcome> {
    if (delivery.attempts > this.config.delivery.maxAttempts) {
      return this.dead(
        DeliveryReason.MAX_ATTEMPTS_EXCEEDED,
        'Delivery attempts were exhausted before completion',
      );
    }
    if (!delivery.destination) {
      return this.dead(
        DeliveryReason.RECIPIENT_ADDRESS_MISSING,
        `Recipient has no address for ${delivery.channel}`,
      );
    }
    if (await this.preferences.isBlocked(delivery.tenantId, delivery.destination)) {
      return this.skipped(DeliveryReason.ADDRESS_BLOCKED, 'Address is on the tenant block list');
    }
    const subject = delivery.notification.recipientSubject;
    if (
      subject !== null &&
      (await this.preferences.isOptedOut(
        delivery.tenantId,
        subject,
        delivery.channel,
        delivery.eventType,
      ))
    ) {
      return this.skipped(
        DeliveryReason.OPTED_OUT,
        'Recipient opted out of this channel and event',
      );
    }
    const template = await this.templates.resolve(
      delivery.tenantId,
      delivery.eventType,
      delivery.channel,
      delivery.notification.locale,
    );
    if (!template) {
      return this.dead(
        DeliveryReason.TEMPLATE_NOT_FOUND,
        `No ${delivery.channel} template for event ${delivery.eventType} in locale ${delivery.notification.locale}`,
      );
    }
    const templateFields = { templateId: template.id, templateVersion: template.version };
    const brand = await this.branding.asVariables(delivery.tenantId);
    const context = { ...(delivery.notification.variables as Record<string, unknown>), brand };
    let message: OutboundMessage;
    try {
      message = {
        deliveryId: delivery.id,
        tenantId: delivery.tenantId,
        eventType: delivery.eventType,
        channel: delivery.channel,
        destination: delivery.destination,
        subject: renderTemplate(template.subject, context, {
          escapeHtml: false,
          maxLength: MAX_RENDERED_SUBJECT_LENGTH,
        }),
        body: renderTemplate(template.body, context, {
          escapeHtml: delivery.channel === 'EMAIL',
          maxLength: MAX_RENDERED_BODY_LENGTH,
        }),
      };
    } catch (error) {
      if (error instanceof TemplateRenderError) {
        return { ...this.dead(error.reason, error.message), ...templateFields };
      }
      throw error;
    }
    try {
      const receipt = await this.registry.senderFor(delivery.channel).send(message);
      return {
        status: 'SENT',
        reason: null,
        detail: null,
        providerMessageId: receipt.providerMessageId ?? null,
        ...templateFields,
      };
    } catch (error) {
      if (error instanceof PermanentSendError) {
        return { ...this.dead(error.reason, error.message), ...templateFields };
      }
      throw error;
    }
  }

  private async retryOrBury(delivery: ClaimedDelivery, error: unknown): Promise<void> {
    const { maxAttempts, retryBaseMs, retryMaxMs } = this.config.delivery;
    const detail = errorText(error);
    if (delivery.attempts >= maxAttempts) {
      await this.repository.settle(
        delivery,
        this.dead(DeliveryReason.MAX_ATTEMPTS_EXCEEDED, detail),
      );
      return;
    }
    const nextAttemptAt = new Date(
      Date.now() + deliveryRetryDelayMs(delivery.attempts, retryBaseMs, retryMaxMs),
    );
    const misconfigured = error instanceof ProviderConfigurationError;
    await this.repository.scheduleRetry(
      delivery,
      nextAttemptAt,
      misconfigured ? DeliveryReason.PROVIDER_MISCONFIGURED : DeliveryReason.PROVIDER_ERROR,
      detail,
    );
    const summary = `delivery ${delivery.id} failed on attempt ${delivery.attempts}: ${detail}`;
    if (misconfigured) {
      this.logger.error(`${summary}; check the ${delivery.channel} provider credentials`);
    } else {
      this.logger.warn(summary);
    }
  }

  private dead(reason: string, detail: string): DeliveryOutcome {
    return { status: 'DEAD', reason, detail };
  }

  private skipped(reason: string, detail: string): DeliveryOutcome {
    return { status: 'SKIPPED', reason, detail };
  }
}
