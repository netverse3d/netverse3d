import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import request from 'supertest';
import { INTERNAL_ERROR_DETAIL } from '../conformance-probe.controller';
import { ConformanceApp, ConformanceHarness } from '../harness';

export function describeHttpStandardConformance(harness: ConformanceHarness): void {
  const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

  function expectErrorEnvelope(body: Record<string, unknown>, code: string, path: string): void {
    expect(body.code).toBe(code);
    expect(typeof body.message).toBe('string');
    expect(body.path).toBe(path);
    expect(body.timestamp).toMatch(ISO_TIMESTAMP);
    expect(typeof body.requestId).toBe('string');
  }

  describe('chuẩn HTTP chung', () => {
    let subject: ConformanceApp;
    const http = () => request(subject.app.getHttpServer());

    beforeAll(async () => {
      subject = await harness.createApp();
    });

    afterAll(() => subject.close());

    describe('response thành công', () => {
      it('bọc kết quả trong code, message, result, requestId', async () => {
        const response = await http().get('/v1/__probe/ok').expect(200);
        expect(response.body).toEqual({
          code: 'SUCCESS',
          message: null,
          result: { value: 1 },
          requestId: response.headers['x-request-id'],
        });
      });
    });

    describe('phân trang', () => {
      it('trả đúng hình content, page, size, totalElements, totalPages với mặc định', async () => {
        const { body } = await http().get('/v1/__probe/paged').expect(200);
        expect(body.result).toEqual({
          content: [{ index: 0 }],
          page: 1,
          size: 20,
          totalElements: 45,
          totalPages: 3,
        });
      });

      it('nhận page và size từ query', async () => {
        const { body } = await http().get('/v1/__probe/paged?page=2&size=10').expect(200);
        expect(body.result).toMatchObject({
          content: [{ index: 10 }],
          page: 2,
          size: 10,
          totalPages: 5,
        });
      });

      it.each(['page=0', 'size=0', 'size=101', 'page=abc', 'sort=name'])(
        'từ chối query %s',
        async (query) => {
          const { body } = await http().get(`/v1/__probe/paged?${query}`).expect(400);
          expectErrorEnvelope(body, 'COMMON.VALIDATION', '/v1/__probe/paged');
        },
      );
    });

    describe('lỗi', () => {
      it('route không tồn tại trả 404 đúng hình', async () => {
        const { body } = await http().get('/v1/khong-ton-tai').expect(404);
        expectErrorEnvelope(body, 'COMMON.NOT_FOUND', '/v1/khong-ton-tai');
      });

      it('lỗi validate liệt kê theo từng trường', async () => {
        const { body } = await http().post('/v1/__probe/echo').send({ name: 'a' }).expect(400);
        expectErrorEnvelope(body, 'COMMON.VALIDATION', '/v1/__probe/echo');
        expect(body.details).toEqual([{ field: 'name', errors: [expect.any(String)] }]);
      });

      it('từ chối trường không khai báo', async () => {
        const { body } = await http()
          .post('/v1/__probe/echo')
          .send({ name: 'ab', extra: 1 })
          .expect(400);
        expect(body.details[0].field).toBe('extra');
      });

      it('JSON hỏng trả 400 đúng hình', async () => {
        const { body } = await http()
          .post('/v1/__probe/echo')
          .set('content-type', 'application/json')
          .send('{"name":')
          .expect(400);
        expectErrorEnvelope(body, 'COMMON.BAD_REQUEST', '/v1/__probe/echo');
      });

      it('body quá lớn trả 413 đúng hình', async () => {
        const { body } = await http()
          .post('/v1/__probe/echo')
          .send({ name: 'x'.repeat(2 * 1024 * 1024) })
          .expect(413);
        expectErrorEnvelope(body, 'COMMON.PAYLOAD_TOO_LARGE', '/v1/__probe/echo');
      });

      it('lỗi không lường trước trả 500 và không lộ chi tiết nội bộ', async () => {
        const response = await http().get('/v1/__probe/boom').expect(500);
        expectErrorEnvelope(response.body, 'COMMON.INTERNAL', '/v1/__probe/boom');
        expect(response.text).not.toContain(INTERNAL_ERROR_DETAIL);
      });

      it('không để lộ query string trong trường path', async () => {
        const { body } = await http().get('/v1/khong-ton-tai?token=abc').expect(404);
        expect(body.path).toBe('/v1/khong-ton-tai');
      });
    });

    describe('định danh request', () => {
      it('tự sinh request id khi client không gửi', async () => {
        const response = await http().get('/v1/__probe/ok');
        expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      });

      it('giữ request id hợp lệ từ client và đưa vào body lỗi', async () => {
        const response = await http()
          .get('/v1/khong-ton-tai')
          .set('x-request-id', 'trace-12345678');
        expect(response.headers['x-request-id']).toBe('trace-12345678');
        expect(response.body.requestId).toBe('trace-12345678');
      });

      it('thay request id chứa ký tự không an toàn', async () => {
        const response = await http().get('/v1/__probe/ok').set('x-request-id', 'bad id<script>');
        expect(response.headers['x-request-id']).not.toContain('script');
      });
    });

    describe('xác thực', () => {
      it('mặc định chặn route không khai công khai', async () => {
        const { body } = await http().get('/v1/__probe/protected').expect(401);
        expectErrorEnvelope(body, 'COMMON.UNAUTHENTICATED', '/v1/__probe/protected');
      });

      it('nhận token hợp lệ', async () => {
        const token = await subject.tokens.sign();
        await http()
          .get('/v1/__probe/protected')
          .set('authorization', `Bearer ${token}`)
          .expect(200);
      });

      it.each([
        ['sai audience', { audience: 'other-service' }],
        ['sai issuer', { issuer: 'https://other.test' }],
        ['đã hết hạn', { expiresIn: '-1s' }],
        ['ký bằng khoá lạ', { signedByUnknownKey: true }],
      ])('từ chối token %s', async (_name, claims) => {
        const token = await subject.tokens.sign(claims);
        await http()
          .get('/v1/__probe/protected')
          .set('authorization', `Bearer ${token}`)
          .expect(401);
      });

      it('chặn người thiếu vai trò bằng 403', async () => {
        const token = await subject.tokens.sign({ roles: ['member'] });
        const { body } = await http()
          .get('/v1/audit-logs')
          .set('authorization', `Bearer ${token}`)
          .expect(403);
        expectErrorEnvelope(body, 'COMMON.FORBIDDEN', '/v1/audit-logs');
      });
    });

    describe('health', () => {
      it('healthz báo sẵn sàng và phiên bản, không cần token', async () => {
        const { body } = await http().get('/healthz').expect(200);
        expect(body).toEqual({ status: 'ok', version: '9.9.9' });
      });

      it('livez báo tiến trình còn sống', async () => {
        await http().get('/livez').expect(200);
      });
    });

    describe('bảo mật header', () => {
      it('có header của helmet và không lộ framework', async () => {
        const response = await http().get('/v1/__probe/ok');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-powered-by']).toBeUndefined();
      });
    });

    describe('swagger', () => {
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
      let document: {
        security: unknown[];
        paths: Record<
          string,
          Record<
            string,
            { tags?: string[]; security?: unknown[]; responses: Record<string, unknown> }
          >
        >;
      };
      const operations = () =>
        Object.entries(document.paths).flatMap(([path, item]) =>
          httpMethods.flatMap((method) => {
            const operation = item[method];
            return operation ? [{ path, method, operation }] : [];
          }),
        );

      beforeAll(async () => {
        document = (await http().get('/docs-json').expect(200)).body;
      });

      it('mở được giao diện /docs', async () => {
        await http().get('/docs/').expect(200);
      });

      it('mặc định yêu cầu bearer ở cấp tài liệu', () => {
        expect(document.security).toEqual([{ bearer: [] }]);
      });

      it('mọi operation có tag và có response thành công', () => {
        for (const { path, method, operation } of operations()) {
          const context = `${method} ${path}`;
          expect([context, operation.tags?.length ?? 0]).not.toEqual([context, 0]);
          expect([
            context,
            Object.keys(operation.responses).some((s) => s.startsWith('2')),
          ]).toEqual([context, true]);
        }
      });

      it('route công khai không đòi token, route còn lại khai đủ lỗi chuẩn', () => {
        for (const { path, method, operation } of operations()) {
          const context = `${method} ${path}`;
          const required =
            operation.security?.length === 0
              ? ['400', '429', '500']
              : ['400', '401', '403', '429', '500'];
          expect([context, required.filter((status) => !operation.responses[status])]).toEqual([
            context,
            [],
          ]);
        }
      });

      it('mọi route nghiệp vụ nằm dưới phiên bản /v1', () => {
        const unversioned = Object.keys(document.paths).filter(
          (path) => !path.startsWith('/v1/') && !harness.unversionedPaths.includes(path),
        );
        expect(unversioned).toEqual([]);
      });

      it('openapi.yaml trong repo khớp các route đang chạy', () => {
        const exported = load(readFileSync(harness.openApiFile, 'utf8')) as {
          paths: Record<string, unknown>;
        };
        expect(Object.keys(exported.paths).sort()).toEqual(Object.keys(document.paths).sort());
      });

      it('openapi.yaml trong repo trùng từng operation và schema với tài liệu service đang sinh ra', async () => {
        const exported = load(readFileSync(harness.openApiFile, 'utf8')) as Record<string, unknown>;
        const running = (await http().get('/docs-json').expect(200)).body as Record<
          string,
          unknown
        >;
        expect(exported.paths).toEqual(JSON.parse(JSON.stringify(running.paths)));
        expect(exported.components).toEqual(JSON.parse(JSON.stringify(running.components)));
      });

      it('chỉ các route đã khai mới công khai', () => {
        const publicPaths = operations()
          .filter(({ operation }) => operation.security?.length === 0)
          .map(({ path }) => path)
          .sort();
        expect(publicPaths).toEqual(harness.publicPaths);
      });
    });
  });
}
