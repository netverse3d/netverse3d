import { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { KitConfig } from '../config/kit-config';
import { setupApp } from './setup-app';

export async function runService(appModule: Type<unknown>): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(appModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const config = app.get(KitConfig);
  app.useLogger(app.get(Logger));
  setupApp(app, config);
  await app.listen(config.http.port);
}
