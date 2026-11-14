import { errors as joseErrors } from 'jose';
import type { Actor } from '../../common/context/request-context';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';

export const PLATFORM_ADMIN_ROLE = 'platform_admin';
export const TENANT_ADMIN_ROLE = 'admin';
export const PLATFORM_SCOPE = 'platform';
export const SCOPE_ADMIN_ROLES = [TENANT_ADMIN_ROLE, PLATFORM_ADMIN_ROLE] as const;

export function scopeOf(actor: Actor): string {
  if (actor.service) {
    throw new AppException(ErrorCode.FORBIDDEN);
  }
  return actor.tenantId ?? PLATFORM_SCOPE;
}

export function tenantOfClaim(claim: unknown): string | null {
  if (typeof claim !== 'string') {
    return null;
  }
  const normalized = claim.trim().toLowerCase();
  if (normalized === '' || normalized === PLATFORM_SCOPE) {
    throw new joseErrors.JWTClaimValidationFailed(
      'tenant claim is empty or uses a reserved scope',
      {},
      'tenant',
    );
  }
  return claim;
}

export function tenantOfScope(scope: string): string | null {
  return scope === PLATFORM_SCOPE ? null : scope;
}

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
