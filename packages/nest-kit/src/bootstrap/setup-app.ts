import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import {
  REQUEST_ID_HEADER,
  requestContextMiddleware,
} from '../common/context/request-context.middleware';
import { KitConfig } from '../config/kit-config';
import { setupSwagger } from './setup-swagger';

const EXPOSED_HEADERS = [
  REQUEST_ID_HEADER,
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
];

export function setupApp(app: NestExpressApplication, config: KitConfig): void {
  app.set('trust proxy', config.http.trustProxyHops);
  app.use(requestContextMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: config.http.corsOrigins.length > 0 ? config.http.corsOrigins : false,
    exposedHeaders: EXPOSED_HEADERS,
  });
  app.useBodyParser('json', { limit: config.http.bodyLimit });
  app.useBodyParser('urlencoded', { limit: config.http.bodyLimit, extended: true });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  if (config.swagger.enabled) {
    setupSwagger(app, config);
  }
}
