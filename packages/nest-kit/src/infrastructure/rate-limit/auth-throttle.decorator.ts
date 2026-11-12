import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLE_METADATA = 'route:auth-throttle';

export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_METADATA, true);
