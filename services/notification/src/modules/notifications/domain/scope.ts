import { PLATFORM_SCOPE } from '@netverse/nest-kit';

const SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isScope(value: string): boolean {
  const imitatesPlatform = value !== PLATFORM_SCOPE && value.toLowerCase() === PLATFORM_SCOPE;
  return SCOPE_PATTERN.test(value) && !imitatesPlatform;
}
