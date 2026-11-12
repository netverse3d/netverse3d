import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Database } from '../../infrastructure/database/database';
import { ConformanceApp, ConformanceHarness, InspectableDatabase } from '../harness';

export function describeAuditConformance(harness: ConformanceHarness): void {
  describe('audit log', () => {
    let subject: ConformanceApp;
    let prisma: InspectableDatabase;
    const http = () => request(subject.app.getHttpServer());

    beforeAll(async () => {
      subject = await harness.createApp();
      prisma = subject.app.get(Database) as InspectableDatabase;
    });

    afterAll(() => subject.close());

    it('ghi hành động thất bại kèm mã lỗi, người làm và request id', async () => {
      const subjectId = `actor-${randomUUID()}`;
      const token = await subject.tokens.sign({
        subject: subjectId,
        roles: ['editor'],
        tenantId: 'tenant-a',
      });
      const response = await http()
        .post('/v1/__probe/audited-failure')
        .set('authorization', `Bearer ${token}`)
        .set('user-agent', 'conformance')
        .expect(409);

      const row = await prisma.auditLog.findFirstOrThrow({ where: { actorSubject: subjectId } });
      expect(row).toMatchObject({
        action: 'probe.fail',
        resourceType: 'probe',
        outcome: 'FAILURE',
        errorCode: 'COMMON.CONFLICT',
        tenantId: 'tenant-a',
        actorRoles: ['editor'],
        userAgent: 'conformance',
        requestId: response.headers['x-request-id'],
      });
    });

    it('không cho sửa bản ghi audit', async () => {
      const row = await prisma.auditLog.findFirstOrThrow();
      await expect(
        prisma.auditLog.update({ where: { id: row.id }, data: { action: 'tampered' } }),
      ).rejects.toThrow();
    });

    it('không cho xoá bản ghi audit', async () => {
      const row = await prisma.auditLog.findFirstOrThrow();
      await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
    });

    it('quản trị viên xem được theo trang và chỉ thấy tenant của mình', async () => {
      const tenantA = `tenant-${randomUUID()}`;
      const writer = await subject.tokens.sign({ tenantId: tenantA });
      await http()
        .post('/v1/__probe/audited-failure')
        .set('authorization', `Bearer ${writer}`)
        .expect(409);

      const adminA = await subject.tokens.sign({ tenantId: tenantA, roles: ['admin'] });
      const own = await http()
        .get('/v1/audit-logs?size=5')
        .set('authorization', `Bearer ${adminA}`)
        .expect(200);
      expect(own.body.result.totalElements).toBe(1);
      expect(own.body.result.content[0].tenantId).toBe(tenantA);

      const adminB = await subject.tokens.sign({
        tenantId: `tenant-${randomUUID()}`,
        roles: ['admin'],
      });
      const other = await http()
        .get('/v1/audit-logs')
        .set('authorization', `Bearer ${adminB}`)
        .expect(200);
      expect(other.body.result.totalElements).toBe(0);
    });
  });
}
