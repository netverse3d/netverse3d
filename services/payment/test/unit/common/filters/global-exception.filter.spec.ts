import { ArgumentsHost } from '@nestjs/common';
import { AppException } from '@netverse/nest-kit';
import { ErrorCode } from '@netverse/nest-kit';
import { GlobalExceptionFilter } from '@netverse/nest-kit';

function buildHost() {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = { originalUrl: '/v1/payment-intents?x=1' };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  return { response, host };
}

describe('GlobalExceptionFilter — chuẩn hoá BigInt trong details', () => {
  it('details chứa BigInt -> number khi nhỏ, string khi vượt ngưỡng số an toàn', () => {
    const { response, host } = buildHost();
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

    new GlobalExceptionFilter().catch(
      new AppException(ErrorCode.VALIDATION, {
        message: 'Invalid amount',
        details: { totalMinor: huge, small: 5n },
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'COMMON.VALIDATION',
        message: 'Invalid amount',
        details: { totalMinor: huge.toString(), small: 5 },
        path: '/v1/payment-intents',
      }),
    );
  });
});
