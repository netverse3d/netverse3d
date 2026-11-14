import { Injectable, Logger } from '@nestjs/common';
import { InputJson, WebhookEventCreateInput } from '@app/infrastructure/prisma/prisma.types';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { RawHttpResponse } from '@app/common/dto/raw-http-response';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import {
  PaymentProvider,
  ProviderAccountContext,
  ProviderWebhookInspection,
  ProviderWebhookOutcome,
  ProviderWebhookRequest,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import { ProviderEventRecorder, TARGET_NOT_FOUND } from './provider-event-recorder.service';

interface WebhookRefs {
  providerPaymentId?: string | null;
  merchantReference?: string | null;
  merchantReferenceCandidates?: readonly string[];
  paymentIntentPublicId?: string | null;
}

type IngestResult = Awaited<ReturnType<ProviderWebhookService['ingest']>>;

interface WebhookTarget {
  attempt: Awaited<ReturnType<PaymentAttemptRepository['findByProviderPaymentId']>>;
  intent: Awaited<ReturnType<PaymentIntentRepository['findById']>>;
}

@Injectable()
export class ProviderWebhookService {
  private readonly logger = new Logger(ProviderWebhookService.name);

  constructor(
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly intentRepository: PaymentIntentRepository,
    private readonly attemptRepository: PaymentAttemptRepository,
    private readonly providerAccounts: ProviderAccountResolver,
    private readonly recorder: ProviderEventRecorder,
  ) {}

  async handle(
    providerCode: string,
    request: ProviderWebhookRequest,
  ): Promise<IngestResult | RawHttpResponse> {
    const provider = this.providerRegistry.get(providerCode);
    if (!provider.acknowledgeWebhook) return this.ingest(providerCode, request);

    let outcome: ProviderWebhookOutcome;
    try {
      outcome = this.toOutcome(await this.ingest(providerCode, request));
    } catch (error) {
      const statusCode = error instanceof AppException ? error.getStatus() : 500;
      if (statusCode >= 500) {
        this.logger.error(
          `Webhook "${providerCode}" system failure: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      outcome = {
        kind: 'rejected',
        statusCode,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    const ack = provider.acknowledgeWebhook(outcome);
    return new RawHttpResponse(ack.httpStatus, ack.body);
  }

  async ingest(providerCode: string, request: ProviderWebhookRequest) {
    const provider = this.providerRegistry.get(providerCode);
    const method = request.method.toUpperCase();
    if (!provider.capabilities().webhookMethods.some((allowed) => allowed === method)) {
      throw new AppException(PaymentErrorCode.WEBHOOK_METHOD_NOT_ALLOWED, {
        message: `Provider "${providerCode}" does not accept ${method} webhooks`,
      });
    }

    const routeAccount = await this.resolveRouteAccount(provider, request.routeAccountRef ?? null);
    let inspection = provider.inspectWebhook(request, routeAccount);
    let inspected = await this.resolveTarget(providerCode, inspection);
    const providerAccount =
      routeAccount ??
      (await this.resolveAccount(providerCode, inspected, inspection.accountRef ?? null));
    if (!routeAccount && providerAccount) {
      const accountInspection = provider.inspectWebhook(request, providerAccount);
      if (!this.sameCandidates(inspection, accountInspection)) {
        inspection = accountInspection;
        inspected = await this.resolveTarget(providerCode, inspection);
      }
    }

    const verification = provider.verifyWebhook(request, providerAccount);
    if (verification.outcome === 'invalid') {
      throw new AppException(PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID, {
        details: { reason: verification.reason },
      });
    }
    if (verification.outcome === 'no_secret') {
      if (provider.capabilities().requiresWebhookSecret) {
        throw new AppException(PaymentErrorCode.WEBHOOK_SECRET_MISSING, {
          details: { reason: 'NO_SECRET' },
        });
      }
      this.logger.warn(
        `Webhook "${providerCode}" ingested WITHOUT signature verification because the provider account has no webhook secret; acceptable only for test providers`,
      );
    }

    const normalized = await provider.normalizeWebhook(request, providerAccount);
    const { attempt, intent } = this.sameRefs(inspection, normalized)
      ? inspected
      : await this.resolveTarget(providerCode, {
          ...normalized,
          merchantReference: normalized.providerOrderId,
        });
    this.assertAccountOwnsTarget(providerAccount, attempt, intent);

    const eventData: WebhookEventCreateInput = {
      tenant_id: intent?.tenant_id ?? attempt?.tenant_id ?? providerAccount?.tenant_id ?? null,
      payment_intent_id: intent?.id ?? null,
      payment_attempt_id: attempt?.id ?? null,
      provider_code: providerCode,
      provider_event_id: normalized.providerEventId,
      event_type: normalized.eventType,
      signature: verification.outcome === 'verified' ? verification.signature.slice(0, 255) : null,
      payload_json: normalized.payload as InputJson,
      headers_json: this.safeHeaders(request.headers) as InputJson,
    };

    const result = await this.recorder.record(eventData, {
      status: normalized.status,
      intentId: intent?.id ?? null,
      build: (sourceRef) => ({
        providerCode,
        intentId: intent!.id,
        attemptId: attempt?.id ?? null,
        normalized,
        requireAmount: provider.capabilities().webhookReportsAmount,
        acceptsLateSuccess: provider.capabilities().acceptsLateSuccess,
        source: 'webhook',
        sourceRef,
      }),
    });

    if (result.kind === 'duplicate') {
      return {
        duplicate: true as const,
        webhookEventId: result.webhookEventId,
        previousStatus: result.previousStatus,
        previousReason: result.previousReason,
      };
    }
    if (result.kind === 'skipped')
      return {
        duplicate: false as const,
        webhookEventId: result.webhookEventId,
        skipped: true as const,
      };
    if (result.kind === 'unmatched') {
      return {
        duplicate: false as const,
        webhookEventId: result.webhookEventId,
        ignored: true as const,
        reason: TARGET_NOT_FOUND,
      };
    }

    const { outcome } = result;
    if (outcome.kind === 'ignored') {
      return {
        duplicate: false as const,
        webhookEventId: result.webhookEventId,
        ignored: true as const,
        reason: outcome.reason,
        paymentIntentId: outcome.intent.id,
        publicId: outcome.intent.public_id,
        status: outcome.intent.status,
      };
    }
    return {
      duplicate: false as const,
      webhookEventId: result.webhookEventId,
      paymentIntentId: outcome.intent.id,
      publicId: outcome.intent.public_id,
      status: outcome.intent.status,
      outboxEventId: outcome.outboxEventId?.toString() ?? null,
    };
  }

  private async resolveRouteAccount(provider: PaymentProvider, accountRef: string | null) {
    if (!accountRef) return null;
    const account = await this.providerAccounts.byExternalRef(provider.code, accountRef);
    if (!account)
      throw new AppException(PaymentErrorCode.WEBHOOK_ACCOUNT_UNKNOWN, {
        details: { reason: 'UNKNOWN_ACCOUNT' },
      });
    return account;
  }

  private async resolveTarget(
    providerCode: string,
    refs: WebhookRefs & Pick<ProviderWebhookInspection, 'merchantReferenceCandidates'>,
  ): Promise<WebhookTarget> {
    let attempt: WebhookTarget['attempt'] = null;
    if (refs.providerPaymentId) {
      attempt = await this.attemptRepository.findByProviderPaymentId(
        providerCode,
        refs.providerPaymentId,
      );
    }
    const orderRefs = [refs.merchantReference, ...(refs.merchantReferenceCandidates ?? [])].filter(
      (value, index, all): value is string => !!value && all.indexOf(value) === index,
    );
    for (const orderRef of orderRefs) {
      if (attempt) break;
      attempt = await this.attemptRepository.findByProviderOrderId(providerCode, orderRef);
    }
    const intent = attempt?.payment_intents
      ? await this.intentRepository.findById(attempt.payment_intents.id)
      : refs.paymentIntentPublicId
        ? await this.intentRepository.findAnyByPublicId(refs.paymentIntentPublicId)
        : null;
    return { attempt, intent };
  }

  private async resolveAccount(
    providerCode: string,
    target: WebhookTarget,
    accountRef: string | null,
  ): Promise<ProviderAccountContext | null> {
    if (target.attempt?.provider_account_id) {
      return this.providerAccounts.byId(target.attempt.provider_account_id);
    }
    const tenantId = target.attempt?.tenant_id ?? target.intent?.tenant_id ?? null;
    if (tenantId) return this.providerAccounts.activeByTenant(tenantId, providerCode);
    return accountRef ? this.providerAccounts.byExternalRef(providerCode, accountRef) : null;
  }

  private assertAccountOwnsTarget(
    account: ProviderAccountContext | null,
    attempt: { provider_account_id: string | null; tenant_id: string } | null,
    intent: { tenant_id: string } | null,
  ) {
    if (!account) return;
    const foreignTenant =
      (intent && intent.tenant_id !== account.tenant_id) ||
      (attempt && attempt.tenant_id !== account.tenant_id);
    const foreignAccount =
      attempt?.provider_account_id && attempt.provider_account_id !== account.id;
    if (foreignTenant || foreignAccount) {
      throw new AppException(PaymentErrorCode.WEBHOOK_ACCOUNT_MISMATCH);
    }
  }

  private sameRefs(
    inspection: WebhookRefs,
    normalized: WebhookRefs & { providerOrderId?: string | null },
  ) {
    return (
      (inspection.providerPaymentId ?? null) === (normalized.providerPaymentId ?? null) &&
      (inspection.merchantReference ?? null) === (normalized.providerOrderId ?? null) &&
      (inspection.paymentIntentPublicId ?? null) === (normalized.paymentIntentPublicId ?? null)
    );
  }

  private sameCandidates(left: ProviderWebhookInspection, right: ProviderWebhookInspection) {
    const a = left.merchantReferenceCandidates ?? [];
    const b = right.merchantReferenceCandidates ?? [];
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  private safeHeaders(headers: ProviderWebhookRequest['headers']) {
    const blocked = new Set(['authorization', 'cookie', 'x-api-key', 'proxy-authorization']);
    return Object.fromEntries(
      Object.entries(headers).filter(([key]) => !blocked.has(key.toLowerCase())),
    );
  }

  private toOutcome(result: IngestResult): ProviderWebhookOutcome {
    if (result.duplicate) {
      return {
        kind: 'duplicate',
        previousStatus: result.previousStatus ?? null,
        previousReason: result.previousReason ?? null,
      };
    }
    if (result.skipped) return { kind: 'skipped' };
    if (result.ignored) return { kind: 'ignored', reason: result.reason ?? 'IGNORED' };
    return { kind: 'processed', status: result.status ?? 'unknown' };
  }
}
