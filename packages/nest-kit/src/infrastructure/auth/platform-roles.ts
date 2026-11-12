import type { Actor } from '../../common/context/request-context';

export const PLATFORM_ADMIN_ROLE = 'platform_admin';
export const TENANT_ADMIN_ROLE = 'admin';

export function isPlatformAdmin(actor: Actor): boolean {
  return actor.tenantId === null && actor.roles.includes(PLATFORM_ADMIN_ROLE);
}

export function isTenantAdmin(actor: Actor): boolean {
  return actor.tenantId !== null && actor.roles.includes(TENANT_ADMIN_ROLE);
}
