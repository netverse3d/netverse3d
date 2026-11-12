import type { Actor } from '@netverse/nest-kit';

export const PLATFORM_ADMIN_ROLE = 'platform_admin';
export const TENANT_ADMIN_ROLE = 'admin';

const PLATFORM_ONLY_ROLES: ReadonlySet<string> = new Set([PLATFORM_ADMIN_ROLE]);

export function isPlatformOnlyRole(name: string): boolean {
  return PLATFORM_ONLY_ROLES.has(name);
}

export function isPlatformAdmin(actor: Actor): boolean {
  return actor.tenantId === null && actor.roles.includes(PLATFORM_ADMIN_ROLE);
}
