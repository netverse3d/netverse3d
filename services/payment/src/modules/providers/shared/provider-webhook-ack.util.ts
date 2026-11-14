import { ProviderWebhookAck, ProviderWebhookOutcome } from '../contracts/payment-provider.contract';

export function providerWebhookAcknowledgement(
  outcome: ProviderWebhookOutcome,
): ProviderWebhookAck {
  if (outcome.kind === 'rejected') {
    const httpStatus = outcome.statusCode >= 500 ? 500 : outcome.statusCode === 401 ? 401 : 400;
    return { httpStatus, body: { success: false } };
  }
  return { httpStatus: 200, body: { success: true } };
}
