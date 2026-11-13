import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Actor,
  assignActor,
  runWithRequestContext,
} from '../../../../src/common/context/request-context';
import { PERMISSIONS_METADATA } from '../../../../src/common/decorators/permissions.decorator';
import { ROLES_METADATA } from '../../../../src/common/decorators/roles.decorator';
import { RolesGuard } from '../../../../src/infrastructure/auth/roles.guard';

const context = { getHandler: () => null, getClass: () => null } as unknown as ExecutionContext;

interface RouteRules {
  roles?: string[];
  permissions?: string[];
}

function allows(route: RouteRules, actor: Actor): boolean {
  const reflector = {
    getAllAndOverride: (key: string) =>
      ({ [ROLES_METADATA]: route.roles, [PERMISSIONS_METADATA]: route.permissions })[key],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  let allowed = false;
  runWithRequestContext({ requestId: 'request-1' } as never, () => {
    assignActor(actor);
    try {
      allowed = guard.canActivate(context);
    } catch {
      allowed = false;
    }
  });
  return allowed;
}

const user = (tenantId: string | null, roles: string[]): Actor => ({
  subject: 'principal-1',
  tenantId,
  roles,
});
const service = (permissions: string[]): Actor => ({
  subject: 'service:shop',
  tenantId: null,
  roles: [],
  service: { clientId: 'shop', permissions },
});

describe('guard vai trò với người dùng', () => {
  it('route của quản trị nền tảng nhận token không gắn tenant mang platform_admin', () => {
    expect(allows({ roles: ['platform_admin'] }, user(null, ['platform_admin']))).toBe(true);
  });

  it('route của quản trị nền tảng từ chối token gắn tenant mang tên vai trò đó', () => {
    expect(allows({ roles: ['platform_admin'] }, user('tenant-1', ['platform_admin']))).toBe(false);
  });

  it('route của quản trị tenant từ chối token không gắn tenant mang vai trò admin', () => {
    expect(allows({ roles: ['admin', 'platform_admin'] }, user(null, ['admin']))).toBe(false);
  });

  it('route của quản trị tenant nhận admin của một tenant', () => {
    expect(allows({ roles: ['admin', 'platform_admin'] }, user('tenant-1', ['admin']))).toBe(true);
  });

  it('route không đòi vai trò thì người dùng nào cũng qua', () => {
    expect(allows({}, user(null, []))).toBe(true);
  });

  it('route chỉ khai quyền của service thì người dùng bị từ chối, kể cả quản trị nền tảng', () => {
    expect(allows({ permissions: ['tenant:create'] }, user(null, ['platform_admin']))).toBe(false);
    expect(allows({ permissions: ['tenant:create'] }, user('tenant-1', ['admin']))).toBe(false);
  });

  it('route khai cả vai trò lẫn quyền thì người dùng đủ vai trò vẫn qua', () => {
    const route = { roles: ['admin'], permissions: ['notification:send'] };
    expect(allows(route, user('tenant-1', ['admin']))).toBe(true);
    expect(allows(route, user('tenant-1', []))).toBe(false);
  });
});

describe('guard vai trò với service', () => {
  it('service có đủ quyền thì qua route khai quyền đó', () => {
    expect(allows({ permissions: ['tenant:create'] }, service(['tenant:create']))).toBe(true);
  });

  it('service thiếu một trong các quyền route đòi thì bị từ chối', () => {
    const route = { permissions: ['tenant:create', 'tenant:assign-owner'] };
    expect(allows(route, service(['tenant:create']))).toBe(false);
  });

  it('route không khai quyền nào thì từ chối service, để service không đóng vai người dùng', () => {
    expect(allows({}, service(['tenant:create']))).toBe(false);
  });

  it('route chỉ khai vai trò thì từ chối service', () => {
    expect(allows({ roles: ['admin'] }, service(['tenant:create']))).toBe(false);
  });

  it('route khai cả vai trò lẫn quyền thì service đủ quyền vẫn qua', () => {
    const route = { roles: ['admin'], permissions: ['notification:send'] };
    expect(allows(route, service(['notification:send']))).toBe(true);
  });
});
