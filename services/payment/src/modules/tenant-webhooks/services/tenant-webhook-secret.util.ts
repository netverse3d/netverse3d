export function tenantWebhookSecretAad(tenantId: string, endpointId: string): string {
  return `tenant-webhook:${tenantId}:${endpointId}`;
}
