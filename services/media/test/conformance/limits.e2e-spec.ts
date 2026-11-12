import request from 'supertest';
import { createTestApp, TestApp } from '../support/test-app';

describe('giới hạn của pipeline', () => {
  describe('rate limit', () => {
    let subject: TestApp;
    const http = () => request(subject.app.getHttpServer());

    beforeAll(async () => {
      subject = await createTestApp({ RATE_LIMIT_MAX: '3' });
    });

    afterAll(() => subject.close());

    it('báo hạn mức qua header', async () => {
      const response = await http().get('/v1/__probe/paged');
      expect(response.headers['x-ratelimit-limit']).toBe('3');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('vượt hạn mức trả 429 đúng hình, chặn cả request chưa xác thực', async () => {
      await http().get('/v1/__probe/protected').expect(401);
      await http().get('/v1/__probe/protected').expect(401);
      await http().get('/v1/__probe/protected').expect(401);
      const response = await http().get('/v1/__probe/protected').expect(429);
      expect(response.body.code).toBe('COMMON.RATE_LIMITED');
      expect(response.body.requestId).toEqual(expect.any(String));
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('không tính health vào hạn mức', async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await http().get('/healthz').expect(200);
      }
    });
  });

  describe('thời gian xử lý', () => {
    let subject: TestApp;

    beforeAll(async () => {
      subject = await createTestApp({ REQUEST_TIMEOUT_MS: '50' });
    });

    afterAll(() => subject.close());

    it('quá thời gian trả 504 đúng hình', async () => {
      const { body } = await request(subject.app.getHttpServer())
        .get('/v1/__probe/slow')
        .expect(504);
      expect(body.code).toBe('COMMON.TIMEOUT');
    });
  });

  describe('tài liệu API', () => {
    it('tắt được swagger', async () => {
      const subject = await createTestApp({ SWAGGER_ENABLED: 'false' });
      await request(subject.app.getHttpServer()).get('/docs-json').expect(404);
      await subject.close();
    });
  });

  describe('cổng phụ thuộc', () => {
    it('báo 503 khi không kết nối được bộ khoá xác thực', async () => {
      const subject = await createTestApp();
      const token = await subject.tokens.sign();
      await subject.tokens.stop();
      const { body } = await request(subject.app.getHttpServer())
        .get('/v1/__probe/protected')
        .set('authorization', `Bearer ${token}`)
        .expect(503);
      expect(body.code).toBe('COMMON.SERVICE_UNAVAILABLE');
      await subject.app.close();
    });
  });
});
