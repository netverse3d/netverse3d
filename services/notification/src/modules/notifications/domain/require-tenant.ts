import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { NotificationErrorCode } from '../notification-error-codes';

export function requireTenant(actor: Actor): string {
  if (!actor.tenantId) {
    throw new AppException(NotificationErrorCode.TENANT_REQUIRED);
  }
  return actor.tenantId;
}
