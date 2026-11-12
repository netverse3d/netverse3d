import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { errors as joseErrors } from 'jose';
import { PinoLogger } from 'nestjs-pino';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtVerifier } from './jwt-verifier.service';

function guardFailingWith(error: unknown): JwtAuthGuard {
  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  const verifier = { verify: () => Promise.reject(error) } as unknown as JwtVerifier;
  return new JwtAuthGuard(reflector, verifier, { assign: jest.fn() } as unknown as PinoLogger);
}

const requestWithToken = {
  getHandler: () => undefined,
  getClass: () => undefined,
  switchToHttp: () => ({ getRequest: () => ({ header: () => 'Bearer token' }) }),
} as unknown as ExecutionContext;

async function failureOf(guard: JwtAuthGuard): Promise<AppException> {
  return guard.canActivate(requestWithToken).then(
    () => {
      throw new Error('expected the guard to reject');
    },
    (error: AppException) => error,
  );
}

describe('xác thực token', () => {
  it('trả 401 khi token không hợp lệ', async () => {
    const failure = await failureOf(guardFailingWith(new joseErrors.JWTExpired('expired', {})));
    expect(failure.definition).toBe(ErrorCode.UNAUTHENTICATED);
  });

  it('trả 503 khi không lấy được bộ khoá, không coi là token sai', async () => {
    const failure = await failureOf(guardFailingWith(new TypeError('fetch failed')));
    expect(failure.definition).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('trả 503 khi lấy bộ khoá quá thời gian', async () => {
    const failure = await failureOf(guardFailingWith(new joseErrors.JWKSTimeout()));
    expect(failure.definition).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });
});
