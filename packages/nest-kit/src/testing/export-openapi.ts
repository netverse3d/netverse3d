import { writeFileSync } from 'node:fs';
import { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { dump } from 'js-yaml';
import { setupApp } from '../bootstrap/setup-app';
import { buildOpenApiDocument } from '../bootstrap/setup-swagger';
import { KitConfig } from '../config/kit-config';

export async function exportOpenApiFile(appModule: Type<unknown>, file: string): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(appModule, {
    logger: false,
    bodyParser: false,
  });
  const config = app.get(KitConfig);
  setupApp(app, config);
  writeFileSync(file, dump(buildOpenApiDocument(app, config), { noRefs: true, lineWidth: -1 }));
  await app.close();
}
