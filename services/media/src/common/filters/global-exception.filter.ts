import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { currentRequestId } from '../context/request-context';
import { ApiErrorResponseDto } from '../dto/api-response.dto';
import { AppException } from '../errors/app.exception';
import { ErrorCode, ErrorCodeDefinition, errorCodeForStatus } from '../errors/error-code';

interface ResolvedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const PRISMA_RECORD_NOT_FOUND = 'P2025';

function fromDefinition(definition: ErrorCodeDefinition): ResolvedError {
  return { status: definition.httpStatus, code: definition.code, message: definition.message };
}

function clientErrorStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) {
    return null;
  }
  const { status } = exception as { status?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}

export function resolveError(exception: unknown): ResolvedError {
  if (exception instanceof AppException) {
    return {
      status: exception.definition.httpStatus,
      code: exception.definition.code,
      message: exception.message,
      details: exception.details,
    };
  }
  if (exception instanceof ThrottlerException) {
    return fromDefinition(ErrorCode.RATE_LIMITED);
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === PRISMA_UNIQUE_VIOLATION) {
      return fromDefinition(ErrorCode.CONFLICT);
    }
    if (exception.code === PRISMA_RECORD_NOT_FOUND) {
      return fromDefinition(ErrorCode.NOT_FOUND);
    }
    return fromDefinition(ErrorCode.INTERNAL);
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const definition = errorCodeForStatus(status);
    return {
      status,
      code: definition.code,
      message: status < 500 ? exception.message : definition.message,
    };
  }
  const status = clientErrorStatus(exception);
  return fromDefinition(status === null ? ErrorCode.INTERNAL : errorCodeForStatus(status));
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const error = resolveError(exception);

    if (error.status >= 500) {
      this.logger.error(exception instanceof Error ? exception : String(exception));
    }
    if (response.headersSent) {
      return;
    }

    const body: ApiErrorResponseDto = {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
      path: request.originalUrl.split('?')[0] ?? '',
      timestamp: new Date().toISOString(),
      requestId: currentRequestId(),
    };
    response.status(error.status).json(body);
  }
}
