import { asRecord, providerRequestJson, stringField } from '../shared/provider-http.client';
import {
  payosSign,
  payosCreateSignatureData,
  verifyPayosDataSignature,
} from './payos-signature.util';

export interface PayosCredentials {
  clientId: string;
  apiKey: string;
  checksumKey: string;
}

export interface PayosCreateRequest {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  expiredAt: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}

export class PayosApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`payOS ${code}: ${message}`);
    this.name = 'PayosApiError';
  }
}

export class PayosSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayosSignatureError';
  }
}

export class PayosApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  createPaymentLink(credentials: PayosCredentials, request: PayosCreateRequest) {
    const signature = payosSign(credentials.checksumKey, payosCreateSignatureData(request));
    return this.call(credentials, 'POST', '/v2/payment-requests', { ...request, signature }, true);
  }

  getPaymentLink(credentials: PayosCredentials, id: string | number) {
    return this.call(
      credentials,
      'GET',
      `/v2/payment-requests/${encodeURIComponent(String(id))}`,
      undefined,
      true,
    );
  }

  cancelPaymentLink(credentials: PayosCredentials, id: string | number, reason: string) {
    return this.call(
      credentials,
      'POST',
      `/v2/payment-requests/${encodeURIComponent(String(id))}/cancel`,
      { cancellationReason: reason },
      false,
    );
  }

  confirmWebhook(credentials: PayosCredentials, webhookUrl: string) {
    return this.call(credentials, 'POST', '/confirm-webhook', { webhookUrl }, false);
  }

  private async call(
    credentials: PayosCredentials,
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    requireSignature: boolean,
  ) {
    const response = await providerRequestJson(
      `${this.baseUrl.replace(/\/+$/, '')}${path}`,
      {
        method,
        headers: { 'x-client-id': credentials.clientId, 'x-api-key': credentials.apiKey },
        body,
      },
      this.timeoutMs,
    );
    const envelope = asRecord(response.body);
    const code = stringField(envelope.code);
    if (code !== '00')
      throw new PayosApiError(
        code || `HTTP_${response.status}`,
        stringField(envelope.desc) || 'request failed',
      );
    const data = asRecord(envelope.data);
    const signature = stringField(envelope.signature);
    if (requireSignature && !verifyPayosDataSignature(credentials.checksumKey, data, signature)) {
      throw new PayosSignatureError('payOS response signature mismatch');
    }
    return data;
  }
}
