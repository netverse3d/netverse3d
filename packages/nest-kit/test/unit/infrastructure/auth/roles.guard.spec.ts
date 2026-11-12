import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { assignActor, runWithRequestContext } from '../../../../src/common/context/request-context';
import { RolesGuard } from '../../../../src/infrastructure/auth/roles.guard';

const context = { getHandler: () => null, getClass: () => null } as unknown as ExecutionContext;

function allows(required: string[], tenantId: string | null, roles: string[]): boolean {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  let allowed = false;
  runWithRequestContext({ requestId: 'request-1' } as never, () => {
    assignActor({ subject: 'principal-1', tenantId, roles });
    try {
      allowed = guard.canActivate(context);
    } catch {
      allowed = false;
    }
  });
  return allowed;
}

describe('guard vai trò', () => {
  it('route của quản trị nền tảng nhận token không gắn tenant mang platform_admin', () => {
    expect(allows(['platform_admin'], null, ['platform_admin'])).toBe(true);
  });

  it('route của quản trị nền tảng từ chối token gắn tenant mang tên vai trò đó', () => {
    expect(allows(['platform_admin'], 'tenant-1', ['platform_admin'])).toBe(false);
  });

  it('route của quản trị tenant từ chối token không gắn tenant mang vai trò admin', () => {
    expect(allows(['admin', 'platform_admin'], null, ['admin'])).toBe(false);
  });

  it('route của quản trị tenant nhận admin của một tenant', () => {
    expect(allows(['admin', 'platform_admin'], 'tenant-1', ['admin'])).toBe(true);
  });

  it('route không đòi vai trò thì ai cũng qua', () => {
    expect(allows([], null, [])).toBe(true);
  });
});
