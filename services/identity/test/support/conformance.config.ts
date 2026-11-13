export const UNVERSIONED_PATHS = ['/healthz', '/livez', '/.well-known/jwks.json'];

export const PUBLIC_PATHS = [
  '/.well-known/jwks.json',
  '/healthz',
  '/livez',
  '/v1/auth/login',
  '/v1/auth/logout',
  '/v1/auth/password/forgot',
  '/v1/auth/password/reset',
  '/v1/auth/providers',
  '/v1/auth/refresh',
  '/v1/auth/register',
  '/v1/auth/resend-verification',
  '/v1/auth/service-token',
  '/v1/auth/social/{provider}',
  '/v1/auth/verify-email',
];
