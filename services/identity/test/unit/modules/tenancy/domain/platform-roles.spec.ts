import type { Actor } from '@netverse/nest-kit';
import {
  isPlatformAdmin,
  isPlatformOnlyRole,
} from '../../../../../src/modules/tenancy/domain/platform-roles';

const actor = (tenantId: string | null, roles: string[]): Actor => ({
  subject: 'principal-1',
  tenantId,
  roles,
});

describe('vai trò nền tảng', () => {
  it('tên platform_admin chỉ dành cho nền tảng, tên admin thì tenant dùng được', () => {
    expect(isPlatformOnlyRole('platform_admin')).toBe(true);
    expect(isPlatformOnlyRole('admin')).toBe(false);
  });

  it('token không gắn tenant mang platform_admin là quản trị nền tảng', () => {
    expect(isPlatformAdmin(actor(null, ['platform_admin']))).toBe(true);
  });

  it('token gắn tenant mang platform_admin không phải quản trị nền tảng', () => {
    expect(isPlatformAdmin(actor('tenant-1', ['platform_admin']))).toBe(false);
  });

  it('token không gắn tenant, không có vai trò thì không phải quản trị nền tảng', () => {
    expect(isPlatformAdmin(actor(null, []))).toBe(false);
  });
});
