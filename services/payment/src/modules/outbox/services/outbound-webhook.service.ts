import { Injectable } from '@nestjs/common';
import { type RequestOptions } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { ProviderCredentialCryptoService } from '@app/infrastructure/secrets/provider-credential-crypto.service';
import {
  payment_outbox_events,
  tenant_webhook_endpoints,
} from '@app/infrastructure/prisma/prisma.types';
import { signPayload } from '@app/common/utils/signature.util';
import {
  isAllowedWebhookUrl,
  isLoopbackAddress,
  resolveWebhookTarget,
  UnsafeWebhookTargetError,
} from '@app/common/utils/webhook-target.util';
import { ResolvedWebhookAddress } from '@app/common/utils/webhook-target.util';
import { AppConfig } from '@app/config/app-config';
import { tenantWebhookSecretAad } from '@app/modules/tenant-webhooks/services/tenant-webhook-secret.util';

type EncryptedWebhookEndpoint = Pick<
  tenant_webhook_endpoints,
  | 'id'
  | 'tenant_id'
  | 'url'
  | 'secret_ciphertext'
  | 'secret_iv'
  | 'secret_tag'
  | 'secret_key_version'
>;

export type DeliveryAttemptResult =
  | { outcome: 'delivered'; httpStatus: number }
  | { outcome: 'retry'; httpStatus: number | null; error: string }
  | { outcome: 'dead'; httpStatus: number; error: string };

@Injectable()
export class OutboundWebhookService {
  constructor(
    private readonly config: AppConfig,
    private readonly crypto: ProviderCredentialCryptoService,
  ) {}

  buildBody(
    event: Pick<payment_outbox_events, 'id' | 'event_type' | 'created_at' | 'payload_json'>,
  ) {
    return JSON.stringify({
      id: event.id.toString(),
      type: event.event_type,
      occurredAt: event.created_at.toISOString(),
      payload: event.payload_json,
    });
  }

  async send(
    endpoint: EncryptedWebhookEndpoint,
    event: Pick<payment_outbox_events, 'id' | 'event_type' | 'created_at' | 'payload_json'>,
  ): Promise<DeliveryAttemptResult> {
    const body = this.buildBody(event);
    let url: URL;
    try {
      url = new URL(endpoint.url);
    } catch {
      return { outcome: 'dead', httpStatus: 400, error: 'invalid webhook target' };
    }
    const allowTestLoopback =
      this.config.service.environment === 'test' &&
      url.protocol === 'http:' &&
      isLoopbackAddress(url.hostname.replace(/^\[|\]$/g, ''));
    if (!isAllowedWebhookUrl(endpoint.url) && !allowTestLoopback) {
      return { outcome: 'dead', httpStatus: 400, error: 'invalid webhook target' };
    }
    let addresses: ResolvedWebhookAddress[];
    try {
      addresses = await resolveWebhookTarget(url.hostname, allowTestLoopback);
    } catch (error) {
      if (error instanceof UnsafeWebhookTargetError) {
        return { outcome: 'dead', httpStatus: 400, error: 'invalid webhook target' };
      }
      const reason = error instanceof Error ? error.message : String(error);
      return { outcome: 'retry', httpStatus: null, error: `network: ${reason}` };
    }
    let secretData: Record<string, unknown>;
    try {
      secretData = this.crypto.decrypt(
        {
          ciphertext: endpoint.secret_ciphertext,
          iv: endpoint.secret_iv,
          tag: endpoint.secret_tag,
          keyVersion: endpoint.secret_key_version,
        },
        tenantWebhookSecretAad(endpoint.tenant_id, endpoint.id),
      );
    } catch {
      return { outcome: 'retry', httpStatus: null, error: 'webhook secret decryption failed' };
    }
    if (typeof secretData.secret_value !== 'string') {
      return { outcome: 'dead', httpStatus: 500, error: 'invalid webhook secret' };
    }
    const pinnedLookup: NonNullable<RequestOptions['lookup']> = (_hostname, options, callback) => {
      if (options && typeof options === 'object' && options.all) callback(null, addresses);
      else callback(null, addresses[0]!.address, addresses[0]!.family);
    };
    try {
      const status = await requestWebhook(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-event-id': event.id.toString(),
          'x-event-type': event.event_type,
          'x-signature': signPayload(secretData.secret_value, body),
        },
        body,
        timeoutMs: this.config.payment.outboundHttpTimeoutMs,
        lookup: pinnedLookup,
      });
      return classifyResponse(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { outcome: 'retry', httpStatus: null, error: `network: ${reason}` };
    }
  }
}

function requestWebhook(
  url: URL,
  options: {
    method: string;
    headers: Record<string, string>;
    body: string;
    timeoutMs: number;
    lookup: NonNullable<RequestOptions['lookup']>;
  },
): Promise<number> {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: options.method,
        headers: options.headers,
        lookup: options.lookup,
        signal: AbortSignal.timeout(options.timeoutMs),
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end(options.body);
  });
}

export function classifyResponse(status: number): DeliveryAttemptResult {
  if (status >= 200 && status < 300) return { outcome: 'delivered', httpStatus: status };
  if (status >= 500 || status === 408 || status === 425 || status === 429) {
    return { outcome: 'retry', httpStatus: status, error: `HTTP ${status}` };
  }
  return { outcome: 'dead', httpStatus: status, error: `HTTP ${status} (non-retryable)` };
}

export function nextRetryDelayMs(attemptCount: number, random: () => number = Math.random) {
  const base = Math.min(10_000 * 2 ** Math.max(0, attemptCount - 1), 3_600_000);
  const jitter = base * 0.2 * (random() * 2 - 1);
  return Math.round(base + jitter);
}
