import request from 'supertest';
import { PROBE_PERMISSION } from '../conformance-probe.controller';
import { ConformanceApp, ConformanceHarness } from '../harness';

export function describeServiceAccessConformance(harness: ConformanceHarness): void {
  describe('token của service', () => {
    let subject: ConformanceApp;

    beforeAll(async () => {
      subject = await harness.createApp();
    });

    afterAll(() => subject.close());

    const call = (path: string, token: string) =>
      request(subject.app.getHttpServer())
        .get(`/v1/__probe/${path}`)
        .set('authorization', `Bearer ${token}`);

    const serviceToken = (permissions: string[]) =>
      subject.tokens.sign({ subject: 'service:probe', clientId: 'probe', permissions });

    it('service có đủ quyền gọi được route khai quyền đó', async () => {
      await call('service-only', await serviceToken([PROBE_PERMISSION])).expect(200);
    });

    it('service thiếu quyền bị từ chối', async () => {
      await call('service-only', await serviceToken(['other:call'])).expect(403);
    });

    it('service bị từ chối ở route của người dùng, dù token hợp lệ', async () => {
      await call('protected', await serviceToken([PROBE_PERMISSION])).expect(403);
    });

    it('người dùng bị từ chối ở route chỉ dành cho service', async () => {
      const admin = await subject.tokens.sign({ tenantId: 'tenant-a', roles: ['admin'] });
      await call('service-only', admin).expect(403);
    });

    it('quyền nằm trong token của người dùng không mở được route của service', async () => {
      const member = await subject.tokens.sign({
        tenantId: 'tenant-a',
        roles: ['admin'],
        permissions: [PROBE_PERMISSION],
      });
      await call('service-only', member).expect(403);
    });

    it('vai trò ghi trong token của service bị bỏ qua', async () => {
      const dressedUp = await subject.tokens.sign({
        subject: 'service:probe',
        clientId: 'probe',
        permissions: [],
        roles: ['admin', 'platform_admin'],
        tenantId: 'tenant-a',
      });
      await call('admin-or-service', dressedUp).expect(403);
    });

    it('route khai cả vai trò lẫn quyền nhận quản trị tenant và service đủ quyền', async () => {
      const admin = await subject.tokens.sign({ tenantId: 'tenant-a', roles: ['admin'] });
      await call('admin-or-service', admin).expect(200);
      await call('admin-or-service', await serviceToken([PROBE_PERMISSION])).expect(200);
    });

    it('token mang tenant trùng mã phạm vi dành riêng bị từ chối', async () => {
      const reserved = await subject.tokens.sign({ tenantId: 'platform', roles: ['admin'] });
      await call('protected', reserved).expect(401);
    });
  });
}
