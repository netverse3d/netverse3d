import { PLATFORM_ADMIN_ROLE } from '@netverse/nest-kit';

export { PLATFORM_ADMIN_ROLE, isPlatformAdmin, isTenantAdmin } from '@netverse/nest-kit';

const PLATFORM_ONLY_ROLES: ReadonlySet<string> = new Set([PLATFORM_ADMIN_ROLE]);

export function isPlatformOnlyRole(name: string): boolean {
  return PLATFORM_ONLY_ROLES.has(name);
}
