import { HttpStatus } from '@nestjs/common';
import { ErrorCodeDefinition } from '@netverse/nest-kit';

export const MediaErrorCode = {
  NOT_FOUND: {
    code: 'MEDIA.NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Media not found',
  },
  INVALID_UPLOAD: {
    code: 'MEDIA.INVALID_UPLOAD',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Upload request is invalid',
  },
  TYPE_NOT_ALLOWED: {
    code: 'MEDIA.TYPE_NOT_ALLOWED',
    httpStatus: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    message: 'This content type is not allowed',
  },
  SIZE_EXCEEDED: {
    code: 'MEDIA.SIZE_EXCEEDED',
    httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'File exceeds the allowed size',
  },
  CONTENT_TYPE_MISMATCH: {
    code: 'MEDIA.CONTENT_TYPE_MISMATCH',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Uploaded content type does not match the declared type',
  },
  ALREADY_COMPLETED: {
    code: 'MEDIA.ALREADY_COMPLETED',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Media upload was already completed',
  },
  OBJECT_MISSING: {
    code: 'MEDIA.OBJECT_MISSING',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Uploaded object was not found in storage',
  },
  NOT_ACTIVE: {
    code: 'MEDIA.NOT_ACTIVE',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Media is not active',
  },
  EXPIRED: {
    code: 'MEDIA.EXPIRED',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Temporary media has expired',
  },
  RETENTION_HOLD: {
    code: 'MEDIA.RETENTION_HOLD',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Media is under retention and cannot be deleted',
  },
  MODERATION_BLOCKED: {
    code: 'MEDIA.MODERATION_BLOCKED',
    httpStatus: HttpStatus.FORBIDDEN,
    message: 'Media is not available because of its moderation state',
  },
  IDEMPOTENCY_KEY_REUSED: {
    code: 'MEDIA.IDEMPOTENCY_KEY_REUSED',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Idempotency key was reused with a different request',
  },
  STORAGE_UNAVAILABLE: {
    code: 'MEDIA.STORAGE_UNAVAILABLE',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Storage is temporarily unavailable',
  },
} as const satisfies Record<string, ErrorCodeDefinition>;
