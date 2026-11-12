import { HttpStatus } from '@nestjs/common';
import { ErrorCodeDefinition } from '@netverse/nest-kit';

export const IdentityErrorCode = {
  INVALID_CREDENTIALS: {
    code: 'IDENTITY.INVALID_CREDENTIALS',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Email or password is incorrect',
  },
  EMAIL_NOT_VERIFIED: {
    code: 'IDENTITY.EMAIL_NOT_VERIFIED',
    httpStatus: HttpStatus.FORBIDDEN,
    message: 'Email address has not been verified',
  },
  ACCOUNT_SUSPENDED: {
    code: 'IDENTITY.ACCOUNT_SUSPENDED',
    httpStatus: HttpStatus.FORBIDDEN,
    message: 'Account is suspended',
  },
  INVALID_OTP: {
    code: 'IDENTITY.INVALID_OTP',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Code is invalid or has expired',
  },
  REFRESH_INVALID: {
    code: 'IDENTITY.REFRESH_INVALID',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Refresh token is invalid or has expired',
  },
  REFRESH_REUSED: {
    code: 'IDENTITY.REFRESH_REUSED',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Refresh token was already used; the session has been revoked',
  },
  SESSION_REVOKED: {
    code: 'IDENTITY.SESSION_REVOKED',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Session is no longer valid',
  },
  NOT_A_MEMBER: {
    code: 'IDENTITY.NOT_A_MEMBER',
    httpStatus: HttpStatus.FORBIDDEN,
    message: 'You are not an active member of this tenant',
  },
  PROVIDER_DISABLED: {
    code: 'IDENTITY.PROVIDER_DISABLED',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'This sign-in provider is not enabled',
  },
  SOCIAL_CREDENTIAL_INVALID: {
    code: 'IDENTITY.SOCIAL_CREDENTIAL_INVALID',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Provider credential could not be verified',
  },
  PROVIDER_UNAVAILABLE: {
    code: 'IDENTITY.PROVIDER_UNAVAILABLE',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Sign-in provider is temporarily unavailable',
  },
  EMAIL_LINK_REQUIRED: {
    code: 'IDENTITY.EMAIL_LINK_REQUIRED',
    httpStatus: HttpStatus.CONFLICT,
    message:
      'An unverified account already uses this email; verify it before signing in with a provider',
  },
  IDENTITY_ALREADY_LINKED: {
    code: 'IDENTITY.IDENTITY_ALREADY_LINKED',
    httpStatus: HttpStatus.CONFLICT,
    message: 'This provider account is already linked',
  },
  LAST_SIGN_IN_METHOD: {
    code: 'IDENTITY.LAST_SIGN_IN_METHOD',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Add another sign-in method before removing this one',
  },
  PASSWORD_NOT_SET: {
    code: 'IDENTITY.PASSWORD_NOT_SET',
    httpStatus: HttpStatus.CONFLICT,
    message: 'This account has no password',
  },
  TENANT_NOT_FOUND: {
    code: 'IDENTITY.TENANT_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Tenant not found',
  },
  TENANT_SLUG_TAKEN: {
    code: 'IDENTITY.TENANT_SLUG_TAKEN',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Tenant slug is already in use',
  },
  ROLE_NOT_FOUND: {
    code: 'IDENTITY.ROLE_NOT_FOUND',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Role not found',
  },
  MEMBER_NOT_FOUND: {
    code: 'IDENTITY.MEMBER_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Member not found',
  },
  PRINCIPAL_NOT_FOUND: {
    code: 'IDENTITY.PRINCIPAL_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Account not found',
  },
} as const satisfies Record<string, ErrorCodeDefinition>;
