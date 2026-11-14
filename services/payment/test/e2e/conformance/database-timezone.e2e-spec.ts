import { Client } from 'pg';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { createTestApp, TestApp } from '../support/test-app';

async function setDatabaseZone(zone: string): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query('SELECT current_database() AS name');
  await client.query(`ALTER DATABASE "${rows[0].name}" SET timezone TO '${zone}'`);
  await client.end();
}

describe('múi giờ cơ sở dữ liệu', () => {
  let subject: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    await setDatabaseZone('Asia/Bangkok');
    subject = await createTestApp();
    prisma = subject.app.get(PrismaService);
  });

  afterAll(async () => {
    await subject.close();
    await setDatabaseZone('UTC');
  });

  it('phiên làm việc luôn ở UTC dù database khai múi giờ khác', async () => {
    const [row] = await prisma.$queryRaw<
      [{ zone: string }]
    >`SELECT current_setting('TimeZone') AS zone`;
    expect(row.zone).toBe('UTC');
  });

  it('thời điểm ghi xuống và đọc lên không bị lệch', async () => {
    const written = new Date();
    const [row] = await prisma.$queryRaw<
      [{ epoch: number }]
    >`SELECT EXTRACT(EPOCH FROM ${written}::timestamptz)::float8 AS epoch`;
    expect(Math.abs(row.epoch * 1000 - written.getTime())).toBeLessThan(1000);
  });
});
