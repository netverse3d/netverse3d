import type { Actor } from '../../../../src/common/context/request-context';
import { AppException } from '../../../../src/common/errors/app.exception';
import {
  PLATFORM_SCOPE,
  scopeOf,
  tenantOfClaim,
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

  it('claim tiệm vắng mặt nghĩa là token không gắn tiệm', () => {
    expect(tenantOfClaim(undefined)).toBeNull();
    expect(tenantOfClaim(42)).toBeNull();
    expect(tenantOfClaim('shop-1')).toBe('shop-1');
  });

  it.each([['platform'], ['Platform'], ['PLATFORM'], [' platform '], [''], ['   ']])(
    'claim tiệm "%s" giả làm phạm vi nền tảng hoặc để trống thì bị từ chối',
    (claim) => {
      expect(() => tenantOfClaim(claim)).toThrow('reserved');
    },
  );

  it('phạm vi nền tảng không phải là một tiệm', () => {
    expect(tenantOfScope(PLATFORM_SCOPE)).toBeNull();
    expect(tenantOfScope('shop-1')).toBe('shop-1');
  });
});
