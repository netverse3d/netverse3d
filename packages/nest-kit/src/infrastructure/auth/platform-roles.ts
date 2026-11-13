import type { Actor } from '../../common/context/request-context';

export const PLATFORM_ADMIN_ROLE = 'platform_admin';
export const TENANT_ADMIN_ROLE = 'admin';
export const PLATFORM_SCOPE = 'platform';

export function rolesInScope(actor: Actor): string[] {
  const outOfScope = actor.tenantId === null ? TENANT_ADMIN_ROLE : PLATFORM_ADMIN_ROLE;
  return actor.roles.filter((role) => role !== outOfScope);
}

export function isPlatformAdmin(actor: Actor): boolean {
  return rolesInScope(actor).includes(PLATFORM_ADMIN_ROLE);
}

export function isTenantAdmin(actor: Actor): boolean {
  return rolesInScope(actor).includes(TENANT_ADMIN_ROLE);
}
