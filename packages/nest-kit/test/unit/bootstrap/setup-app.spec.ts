import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { setupApp } from '../../../src/bootstrap/setup-app';
import { currentRequestContext } from '../../../src/common/context/request-context';
import { KitConfig } from '../../../src/config/kit-config';

@Controller('ip-probe')
class IpProbeController {
  @Get()
  read(): { ip: string | null } {
    return { ip: currentRequestContext()?.ip ?? null };
  }
}

@Module({ controllers: [IpProbeController] })
class IpProbeModule {}

function configTrusting(trustProxyHops: number): KitConfig {
  return {
    service: { name: 'probe', version: '0.0.0', environment: 'test' },
    http: {
      port: 0,
      corsOrigins: [],
      trustProxyHops,
      bodyLimit: '1mb',
      requestTimeoutMs: 1000,
    },
    swagger: { enabled: false },
  } as unknown as KitConfig;
}

async function ipSeenWith(trustProxyHops: number, forwardedFor: string): Promise<string | null> {
  const app = await NestFactory.create<NestExpressApplication>(IpProbeModule, {
    bodyParser: false,
    logger: false,
  });
  setupApp(app, configTrusting(trustProxyHops));
  await app.init();
  try {
    const response = await request(app.getHttpServer())
      .get('/v1/ip-probe')
      .set('x-forwarded-for', forwardedFor)
      .expect(200);
    return (response.body as { ip: string | null }).ip;
  } finally {
    await app.close();
  }
}

describe('IP của client khi service chạy sau cổng', () => {
  it('không tin proxy thì bỏ qua X-Forwarded-For', async () => {
    const ip = await ipSeenWith(0, '203.0.113.77');
    expect(ip).not.toBe('203.0.113.77');
    expect(ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it('tin một proxy thì lấy IP do proxy thêm vào', async () => {
    const ip = await ipSeenWith(1, '203.0.113.77, 198.51.100.9');
    expect(ip).toBe('198.51.100.9');
  });

  it('tin một proxy không nhận IP client tự chèn phía trước', async () => {
    const ip = await ipSeenWith(1, '203.0.113.77, 198.51.100.9');
    expect(ip).not.toBe('203.0.113.77');
  });
});
