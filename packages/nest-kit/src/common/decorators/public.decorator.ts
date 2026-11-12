import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const IS_PUBLIC_METADATA = 'route:public';

export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC_METADATA, true), ApiExtension('x-route-public', true));
