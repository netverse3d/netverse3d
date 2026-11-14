import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request, { Response } from 'supertest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { DeliveryDispatchJob } from '../../src/modules/delivery/jobs/delivery-dispatch.job';
import type { TestApp } from './test-app';

export function uniqueEvent(prefix = 'event'): string {
  return `${prefix}.${randomUUID()}`;
}

export interface TemplateInput {
  eventType: string;
  channel?: string;
  locale?: string;
  subject?: string;
  body?: string;
  category?: 'TRANSACTIONAL' | 'OPTIONAL';
}

export class Scenario {
  private constructor(
    private readonly subject: TestApp,
    readonly tenantId: string,
    readonly admin: string,
    readonly service: string,
  ) {}

  static async start(subject: TestApp, tenantId = `tenant-${randomUUID()}`): Promise<Scenario> {
    const admin = await subject.tokens.sign({ subject: 'admin-user', tenantId, roles: ['admin'] });
    const service = await subject.tokens.sign({
      subject: 'caller',
      tenantId,
      roles: ['notification:send'],
    });
    return new Scenario(subject, tenantId, admin, service);
  }

  get prisma(): PrismaService {
    return this.subject.app.get(PrismaService);
  }

  http(): ReturnType<typeof request> {
    return request(this.subject.app.getHttpServer() as Server);
  }

  userToken(subject: string, roles: string[] = []): Promise<string> {
    return this.subject.tokens.sign({ subject, tenantId: this.tenantId, roles });
  }

  async createTemplate(input: TemplateInput): Promise<Response> {
    const { category = 'TRANSACTIONAL', ...template } = input;
    const created = await this.http()
      .post('/v1/templates')
      .set('authorization', `Bearer ${this.admin}`)
      .send({
        channel: 'EMAIL',
        locale: 'en',
        subject: 'Subject',
        body: '<p>Hello {{name}}</p>',
        ...template,
      })
      .expect(201);
    if (category === 'TRANSACTIONAL') {
      await this.seedAsTransactional(created.body.result.id as string);
    }
    return created;
  }

  async seedAsTransactional(templateId: string): Promise<void> {
    await this.prisma.notificationTemplate.update({
      where: { id: templateId },
      data: { category: 'TRANSACTIONAL' },
    });
  }

  async send(body: Record<string, unknown>, idempotencyKey?: string): Promise<Response> {
    const test = this.http()
      .post('/v1/notifications')
      .set('authorization', `Bearer ${this.service}`);
    return (idempotencyKey ? test.set('idempotency-key', idempotencyKey) : test).send(body);
  }

  async drain(): Promise<void> {
    const job = this.subject.app.get(DeliveryDispatchJob);
    while ((await job.runOnce()) > 0) {
      await Promise.resolve();
    }
  }

  deliveriesOf(eventType: string) {
    return this.prisma.notificationDelivery.findMany({
      where: { tenantId: this.tenantId, eventType },
      orderBy: { createdAt: 'asc' },
    });
  }

  async makeDue(eventType: string): Promise<void> {
    await this.prisma.notificationDelivery.updateMany({
      where: { tenantId: this.tenantId, eventType, status: 'PENDING' },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });
  }
}
