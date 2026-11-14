import { IT_DATABASE_URL } from '@test/support/integration-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@app/infrastructure/prisma/client';
import { sha256 } from '@app/common/utils/hash.util';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { IdempotencyRepository } from '@app/modules/idempotency/repositories/idempotency.repository';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';

const describeIntegration = IT_DATABASE_URL ? describe : describe.skip;

describeIntegration('IdempotencyService — tích hợp Postgres', () => {
  let prisma: PrismaClient;
  let service: IdempotencyService;
  let tenantId: string;

  beforeAll(async () => {
    const host = new URL(IT_DATABASE_URL!).host;
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
      throw new Error(
        `Integration test chi chay tren DB local dung mot lan, khong chay tren ${host}`,
      );
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: IT_DATABASE_URL!, options: '-c timezone=UTC' }),
    });
    await prisma.$connect();
    service = new IdempotencyService(new IdempotencyRepository(prisma as unknown as PrismaService));
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE tenants, audit_logs CASCADE');
    tenantId = (await prisma.tenants.create({ data: { code: 'it-idem', name: 'Idem' } })).id;
  });

  const context = (key: string, payload: unknown = { amount: 49000 }) => ({
    tenantId,
    scope: 'payments.create-intent',
    key,
    requestPayload: payload,
  });

  it('10 request CÙNG key đồng thời -> operation chạy ĐÚNG 1 lần, không P2002/500', async () => {
    let executions = 0;
    const operation = async () => {
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        resourceType: 'payment_intent',
        resourceId: 'pi-1',
        response: { id: 'pi-1', totalMinor: 49000n },
        statusCode: 201,
      };
    };

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.execute(context('k-concurrent'), operation)),
    );

    expect(executions).toBe(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    for (const r of rejected) {
      expect(r.reason).toMatchObject({
        status: 409,
        details: { reason: 'idempotency_in_progress' },
      });
    }
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10 - rejected.length);

    await expect(service.execute(context('k-concurrent'), operation)).resolves.toEqual({
      id: 'pi-1',
      totalMinor: 49000,
    });
    expect(executions).toBe(1);
    const rows = await prisma.idempotency_records.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      processing_status: 'completed',
      status_code: 201,
      locked_until: null,
    });
  });

  it('record `started` bị bỏ lại (crash) quá lease -> request sau tiếp quản và chạy lại đúng 1 lần', async () => {
    await prisma.idempotency_records.create({
      data: {
        tenant_id: tenantId,
        scope: 'payments.create-intent',
        idempotency_key: 'k-crash',
        request_hash: sha256(JSON.stringify({ amount: 49000 })),
        processing_status: 'started',
        locked_until: new Date(Date.now() - 5_000),
      },
    });

    let executions = 0;
    const operation = async () => {
      executions += 1;
      return {
        resourceType: 'payment_intent',
        resourceId: 'pi-2',
        response: { id: 'pi-2' },
        statusCode: 201,
      };
    };
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.execute(context('k-crash'), operation)),
    );

    expect(executions).toBe(1);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
  });

  it('row `started` CŨ (trước migration, locked_until NULL) -> coi như hết lease, tiếp quản được', async () => {
    await prisma.idempotency_records.create({
      data: {
        tenant_id: tenantId,
        scope: 'payments.create-intent',
        idempotency_key: 'k-legacy',
        request_hash: sha256(JSON.stringify({ amount: 49000 })),
        processing_status: 'started',
      },
    });

    await expect(
      service.execute(context('k-legacy'), async () => ({
        resourceType: 'payment_intent',
        resourceId: 'pi-3',
        response: { id: 'pi-3' },
        statusCode: 201,
      })),
    ).resolves.toEqual({ id: 'pi-3' });
  });

  it('payload khác cùng key -> 409 conflict', async () => {
    await service.execute(context('k-conflict', { amount: 1 }), async () => ({
      resourceType: 'x',
      resourceId: 'x',
      response: {},
      statusCode: 201,
    }));

    await expect(
      service.execute(context('k-conflict', { amount: 2 }), async () => ({
        resourceType: 'x',
        resourceId: 'x',
        response: {},
        statusCode: 201,
      })),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('payload changed') });
  });
});
