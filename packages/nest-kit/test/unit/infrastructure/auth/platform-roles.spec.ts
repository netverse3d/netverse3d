import type { Actor } from '../../../../src/common/context/request-context';
import { isPlatformAdmin, isTenantAdmin } from '../../../../src/infrastructure/auth/platform-roles';

const actor = (tenantId: string | null, roles: string[]): Actor => ({
  subject: 'principal-1',
  tenantId,
  roles,
});

describe('vai trò nền tảng và vai trò tenant', () => {
  it('token không gắn tenant mang platform_admin là quản trị nền tảng', () => {
    expect(isPlatformAdmin(actor(null, ['platform_admin']))).toBe(true);
  });

  it('token gắn tenant mang platform_admin không phải quản trị nền tảng', () => {
    expect(isPlatformAdmin(actor('tenant-1', ['platform_admin']))).toBe(false);
  });

  it('token không gắn tenant, không có vai trò thì không phải quản trị nền tảng', () => {
    expect(isPlatformAdmin(actor(null, []))).toBe(false);
  });

  it('admin của một tenant là quản trị tenant đó', () => {
    expect(isTenantAdmin(actor('tenant-1', ['admin']))).toBe(true);
  });

  it('token không gắn tenant mang admin không phải quản trị tenant nào', () => {
    expect(isTenantAdmin(actor(null, ['admin']))).toBe(false);
  });
});
