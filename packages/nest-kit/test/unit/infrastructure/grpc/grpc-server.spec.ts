import { join } from 'node:path';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { currentActor } from '../../../../src/common/context/request-context';
import { AppException } from '../../../../src/common/errors/app.exception';
import { KitConfig } from '../../../../src/config/kit-config';
import { JwtVerifier } from '../../../../src/infrastructure/auth/jwt-verifier.service';
import {
  CommandCallOptions,
  connectCommands,
  GrpcCallError,
} from '../../../../src/infrastructure/grpc/grpc-caller';
import { loadContractFile } from '../../../../src/infrastructure/grpc/grpc-contract';
import { GrpcServer } from '../../../../src/infrastructure/grpc/grpc-server';
import { TEST_AUDIENCE, TEST_ISSUER, TokenIssuer } from '../../../../src/testing/token-issuer';

const PERMISSION = 'probe:call';
const CONFLICT = {
  code: 'PROBE.ALREADY_DONE',
  httpStatus: HttpStatus.CONFLICT,
  message: 'Already done',
};

interface EchoReply {
  text: string;
  caller: string;
  idempotencyKey: string;
  permissions: string[];
}

jest.setTimeout(30_000);

describe('máy chủ gRPC của nest-kit', () => {
  let tokens: TokenIssuer;
  let server: GrpcServer;
  let address: string;
  const contract = loadContractFile(join(__dirname, 'probe.proto'));

  beforeAll(async () => {
    tokens = await TokenIssuer.start();
    const config = {
      service: { name: 'probe' },
      auth: {
        jwksUrl: tokens.jwksUrl,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        rolesClaim: 'roles',
        tenantClaim: 'tenant_id',
      },
      grpc: { port: 0 },
    } as unknown as KitConfig;
    server = new GrpcServer(config, new JwtVerifier(config));
    server.register(contract, 'netverse.probe.v1.ProbeCommands', {
      Echo: {
        permission: PERMISSION,
        handle: (request: { text: string }, call) =>
          Promise.resolve({
            text: request.text.toUpperCase(),
            caller: `${call.caller.subject}|${currentActor()?.subject ?? 'no-context'}`,
            idempotencyKey: call.idempotencyKey,
            permissions: [...(call.caller.service?.permissions ?? [])],
          }),
      },
      Fail: {
        permission: PERMISSION,
        handle: (request: { kind: string }) =>
          Promise.reject(
            request.kind === 'conflict'
              ? new AppException(CONFLICT)
              : new Error('connection string leaked here'),
          ),
      },
      Slow: {
        permission: PERMISSION,
        handle: () => new Promise((resolve) => setTimeout(() => resolve({ text: 'late' }), 2_000)),
      },
    });
    await server.onApplicationBootstrap();
    address = `127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.onModuleDestroy();
    await tokens.stop();
  });

  const serviceToken = (permissions: string[] = [PERMISSION]) =>
    tokens.sign({ subject: 'service:caller', clientId: 'caller', permissions });

  async function call(
    method: string,
    request: object,
    options: Partial<Omit<CommandCallOptions, 'token'>> & { token?: string | null } = {},
  ): Promise<EchoReply> {
    const commands = connectCommands(contract, 'netverse.probe.v1.ProbeCommands', address);
    try {
      const { token, ...rest } = options;
      return await commands.call<EchoReply>(method, request, {
        idempotencyKey: 'key-1',
        timeoutMs: 5_000,
        ...rest,
        token: token === undefined ? await serviceToken() : (token ?? ''),
      });
    } finally {
      commands.close();
    }
  }

  const failure = async (attempt: Promise<unknown>): Promise<GrpcCallError> => {
    try {
      await attempt;
    } catch (error) {
      return error as GrpcCallError;
    }
    throw new Error('the call was expected to fail');
  };

  it('service có quyền gọi được lệnh, bên xử lý thấy đúng bên gọi và khoá chống trùng', async () => {
    const reply = await call('Echo', { text: 'hello' }, { idempotencyKey: 'order-42' });
    expect(reply).toEqual({
      text: 'HELLO',
      caller: 'service:caller|service:caller',
      idempotencyKey: 'order-42',
      permissions: [PERMISSION],
    });
  });

  it('không có token thì bị từ chối là chưa xác thực', async () => {
    const error = await failure(call('Echo', { text: 'x' }, { token: null }));
    expect(error.status).toBe(GrpcStatus.UNAUTHENTICATED);
  });

  it('token sai chữ ký bị từ chối là chưa xác thực', async () => {
    const forged = await tokens.sign({ clientId: 'caller', signedByUnknownKey: true });
    const error = await failure(call('Echo', { text: 'x' }, { token: forged }));
    expect(error.status).toBe(GrpcStatus.UNAUTHENTICATED);
  });

  it('token của người dùng bị từ chối, kể cả quản trị nền tảng', async () => {
    for (const claims of [
      { subject: 'player' },
      { subject: 'tenant-admin', tenantId: 'tenant-a', roles: ['admin'] },
      { subject: 'root', roles: ['platform_admin'] },
      { subject: 'sneaky', tenantId: 'tenant-a', permissions: [PERMISSION] },
    ]) {
      const error = await failure(
        call('Echo', { text: 'x' }, { token: await tokens.sign(claims) }),
      );
      expect(error.status).toBe(GrpcStatus.PERMISSION_DENIED);
    }
  });

  it('service thiếu quyền của lệnh bị từ chối', async () => {
    const token = await serviceToken(['other:call']);
    const error = await failure(call('Echo', { text: 'x' }, { token }));
    expect(error.status).toBe(GrpcStatus.PERMISSION_DENIED);
  });

  it('thiếu khoá chống trùng bị từ chối trước lúc chạm bên xử lý', async () => {
    const error = await failure(call('Echo', { text: 'x' }, { idempotencyKey: '' }));
    expect(error.status).toBe(GrpcStatus.INVALID_ARGUMENT);
    expect(error.message).toContain('idempotency-key');
  });

  it('lỗi nghiệp vụ đổi sang mã gRPC tương ứng và mang mã lỗi của ứng dụng', async () => {
    const error = await failure(call('Fail', { kind: 'conflict' }));
    expect(error.status).toBe(GrpcStatus.ALREADY_EXISTS);
    expect(error.errorCode).toBe('PROBE.ALREADY_DONE');
    expect(error.message).toContain('Already done');
  });

  it('lỗi không lường trước trả mã nội bộ và không lộ chi tiết', async () => {
    const error = await failure(call('Fail', { kind: 'crash' }));
    expect(error.status).toBe(GrpcStatus.INTERNAL);
    expect(error.message).not.toContain('connection string');
    expect(error.errorCode).toBe('COMMON.INTERNAL');
  });

  it('bên gọi hết hạn chờ thì nhận lỗi quá hạn', async () => {
    const error = await failure(call('Slow', { text: 'x' }, { timeoutMs: 200 }));
    expect(error.status).toBe(GrpcStatus.DEADLINE_EXCEEDED);
  });

  it('bên gọi bắt buộc nêu hạn chờ', async () => {
    const error = await failure(call('Echo', { text: 'x' }, { timeoutMs: 0 }));
    expect(error.message).toContain('timeoutMs');
  });

  it('gọi một lệnh không có trong hợp đồng bị từ chối ở bên gọi, kể cả tên trùng hàm của client', async () => {
    for (const method of ['Missing', 'close', 'Close']) {
      const error = await failure(call(method, {}));
      expect(error.message).toContain('has no command');
    }
  });

  it('khoá chống trùng dài quá giới hạn bị từ chối', async () => {
    const error = await failure(call('Echo', { text: 'x' }, { idempotencyKey: 'k'.repeat(129) }));
    expect(error.status).toBe(GrpcStatus.INVALID_ARGUMENT);
  });

  it('báo đang phục vụ sau lúc khởi động', () => {
    expect(server.isServing()).toBe(true);
  });
});
