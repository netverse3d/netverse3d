import { PLATFORM_SCOPE } from '../../../infrastructure/auth/platform-roles';
import { EventEnvelope } from './event-envelope';

const SERVICE_NAME = /^[a-z][a-z0-9-]*$/;

export function topicFor(source: string): string {
  if (!SERVICE_NAME.test(source)) {
    throw new Error(`Cannot derive an event topic from service name "${source}"`);
  }
  return `netverse.${source}.events.v${1}`;
}

export function scopeKeyOf(event: EventEnvelope): string {
  const { tenantId } = event.data;
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : PLATFORM_SCOPE;
}
