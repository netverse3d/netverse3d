import { HttpStatus } from '@nestjs/common';

export interface ErrorCodeDefinition {
  code: string;
  httpStatus: HttpStatus;
  message: string;
}

export const ErrorCode = {
  VALIDATION: {
    code: 'COMMON.VALIDATION',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Request validation failed',
  },
  BAD_REQUEST: {
    code: 'COMMON.BAD_REQUEST',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Bad request',
  },
  UNAUTHENTICATED: {
    code: 'COMMON.UNAUTHENTICATED',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Authentication is required',
  },
  FORBIDDEN: {
    code: 'COMMON.FORBIDDEN',
    httpStatus: HttpStatus.FORBIDDEN,
    message: 'You do not have permission to perform this action',
  },
  NOT_FOUND: {
    code: 'COMMON.NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Resource not found',
  },
  METHOD_NOT_ALLOWED: {
    code: 'COMMON.METHOD_NOT_ALLOWED',
    httpStatus: HttpStatus.METHOD_NOT_ALLOWED,
    message: 'Method not allowed',
  },
  CONFLICT: {
    code: 'COMMON.CONFLICT',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Resource already exists',
  },
  PAYLOAD_TOO_LARGE: {
    code: 'COMMON.PAYLOAD_TOO_LARGE',
    httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'Request body is too large',
  },
  RATE_LIMITED: {
    code: 'COMMON.RATE_LIMITED',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Too many requests',
  },
  INTERNAL: {
    code: 'COMMON.INTERNAL',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  },
  SERVICE_UNAVAILABLE: {
    code: 'COMMON.SERVICE_UNAVAILABLE',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Service temporarily unavailable',
  },
  TIMEOUT: {
    code: 'COMMON.TIMEOUT',
    httpStatus: HttpStatus.GATEWAY_TIMEOUT,
    message: 'Request timed out',
  },
} as const satisfies Record<string, ErrorCodeDefinition>;

const definitionByStatus = new Map<number, ErrorCodeDefinition>(
  [
    ErrorCode.BAD_REQUEST,
    ErrorCode.UNAUTHENTICATED,
    ErrorCode.FORBIDDEN,
    ErrorCode.NOT_FOUND,
    ErrorCode.METHOD_NOT_ALLOWED,
    ErrorCode.CONFLICT,
    ErrorCode.PAYLOAD_TOO_LARGE,
    ErrorCode.RATE_LIMITED,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.TIMEOUT,
  ].map((definition) => [definition.httpStatus, definition]),
);

export function errorCodeForStatus(status: number): ErrorCodeDefinition {
  return (
    definitionByStatus.get(status) ?? (status < 500 ? ErrorCode.BAD_REQUEST : ErrorCode.INTERNAL)
  );
}
