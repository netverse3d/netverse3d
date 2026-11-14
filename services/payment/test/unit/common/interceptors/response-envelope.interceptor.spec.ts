import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { RawHttpResponse } from '@app/common/dto/raw-http-response';
import { ResponseEnvelopeInterceptor } from '@app/common/interceptors/response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor — envelope và chuẩn hoá BigInt', () => {
  const interceptor = new ResponseEnvelopeInterceptor(new Reflector());
  const handler = () => undefined;
  class TestController {}
  const context = {
    getHandler: () => handler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;

  function run(data: unknown) {
    const next: CallHandler = { handle: () => of(data) };
    return lastValueFrom(interceptor.intercept(context, next));
  }

  it('bọc envelope { code, message, result, requestId }', async () => {
    await expect(run({ hello: 'world' })).resolves.toEqual({
      code: 'SUCCESS',
      message: null,
      result: { hello: 'world' },
      requestId: null,
    });
  });

  it('BigInt nhỏ (<= MAX_SAFE_INTEGER) -> number', async () => {
    await expect(run({ totalMinor: 150000n })).resolves.toMatchObject({
      result: { totalMinor: 150000 },
    });
  });

  it('BigInt vượt MAX_SAFE_INTEGER -> string (kể cả lồng trong array/object)', async () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    await expect(run({ items: [{ amountMinor: huge }], top: huge })).resolves.toMatchObject({
      result: { items: [{ amountMinor: huge.toString() }], top: huge.toString() },
    });
  });

  it('giữ nguyên Date và null', async () => {
    const paidAt = new Date('2026-07-10T00:00:00Z');
    const result = (await run({ paidAt, canceledAt: null })) as {
      result: { paidAt: Date; canceledAt: null };
    };
    expect(result.result.paidAt).toBe(paidAt);
    expect(result.result.canceledAt).toBeNull();
  });

  it('RawHttpResponse -> body nguyên văn + đặt HTTP status, KHÔNG bọc envelope', async () => {
    const status = jest.fn();
    const rawContext = {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: () =>
        of(
          new RawHttpResponse(200, {
            RspCode: '00',
            Message: 'Confirm Success',
            totalMinor: 150000n,
          }),
        ),
    };

    await expect(lastValueFrom(interceptor.intercept(rawContext, next))).resolves.toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
      totalMinor: 150000,
    });
    expect(status).toHaveBeenCalledWith(200);
  });
});
