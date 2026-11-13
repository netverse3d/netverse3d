import type { Actor } from '../../../../src/common/context/request-context';
import { AppException } from '../../../../src/common/errors/app.exception';
import {
  PLATFORM_SCOPE,
  scopeOf,
  tenantOfScope,
} from '../../../../src/infrastructure/auth/platform-roles';

const user = (tenantId: string | null): Actor =>
  ({ subject: 'user-1', tenantId, roles: [] }) as Actor;

describe('phạm vi của người gọi', () => {
  it('token gắn tiệm thì phạm vi là tiệm đó', () => {
    expect(scopeOf(user('shop-1'))).toBe('shop-1');
  });

  it('token của người dùng không gắn tiệm thì phạm vi là nền tảng', () => {
    expect(scopeOf(user(null))).toBe(PLATFORM_SCOPE);
  });

  it('service không được suy phạm vi ngầm', () => {
    const service = {
      ...user(null),
      service: { clientId: 'svc', permissions: [] },
    } as Actor;
    expect(() => scopeOf(service)).toThrow(AppException);
  });

  it('phạm vi nền tảng không phải là một tiệm', () => {
    expect(tenantOfScope(PLATFORM_SCOPE)).toBeNull();
    expect(tenantOfScope('shop-1')).toBe('shop-1');
  });
});
