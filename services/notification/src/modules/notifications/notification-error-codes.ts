import { HttpStatus } from '@nestjs/common';
import { ErrorCodeDefinition } from '@netverse/nest-kit';

export const NotificationErrorCode = {
  TENANT_REQUIRED: {
    code: 'NOTIFICATION.TENANT_REQUIRED',
    httpStatus: HttpStatus.FORBIDDEN,
    message: 'This operation requires a tenant in the access token',
  },
  TEMPLATE_INVALID: {
    code: 'NOTIFICATION.TEMPLATE_INVALID',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Template could not be compiled',
  },
  TEMPLATE_NOT_FOUND: {
    code: 'NOTIFICATION.TEMPLATE_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Template not found',
  },
  TEMPLATE_KEY_TAKEN: {
    code: 'NOTIFICATION.TEMPLATE_KEY_TAKEN',
    httpStatus: HttpStatus.CONFLICT,
    message: 'A template already exists for this event, channel and locale',
  },
  RECIPIENT_REQUIRED: {
    code: 'NOTIFICATION.RECIPIENT_REQUIRED',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Recipient must include a subject, an email or device tokens',
  },
  INVALID_CHARACTERS: {
    code: 'NOTIFICATION.INVALID_CHARACTERS',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Request must not contain null characters',
  },
  IDEMPOTENCY_KEY_INVALID: {
    code: 'NOTIFICATION.IDEMPOTENCY_KEY_INVALID',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Idempotency key is too long',
  },
  IDEMPOTENCY_KEY_REUSED: {
    code: 'NOTIFICATION.IDEMPOTENCY_KEY_REUSED',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Idempotency key was reused with a different request',
  },
  INBOX_ITEM_NOT_FOUND: {
    code: 'NOTIFICATION.INBOX_ITEM_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Inbox item not found',
  },
  BRANDING_NOT_FOUND: {
    code: 'NOTIFICATION.BRANDING_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Branding entry not found',
  },
  BLOCKED_ADDRESS_NOT_FOUND: {
    code: 'NOTIFICATION.BLOCKED_ADDRESS_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Blocked address not found',
  },
  ADDRESS_ALREADY_BLOCKED: {
    code: 'NOTIFICATION.ADDRESS_ALREADY_BLOCKED',
    httpStatus: HttpStatus.CONFLICT,
    message: 'This address is already blocked',
  },
} as const satisfies Record<string, ErrorCodeDefinition>;
