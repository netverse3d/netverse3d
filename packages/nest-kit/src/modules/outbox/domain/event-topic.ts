import { PLATFORM_SCOPE } from '../../../infrastructure/auth/platform-roles';
import { EventEnvelope } from './event-envelope';

const SERVICE_NAME = /^[a-z][a-z0-9-]*$/;
const CONTRACT_VERSION = 1;

export function isServiceName(name: string): boolean {
  return SERVICE_NAME.test(name);
}

export function topicFor(source: string): string {
  if (!isServiceName(source)) {
    throw new Error(`Cannot derive an event topic from service name "${source}"`);
  }
  return `netverse.${source}.events.v${CONTRACT_VERSION}`;
}

export function scopeKeyOf(event: EventEnvelope): string {
  const { tenantId } = event.data;
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : PLATFORM_SCOPE;
}
