import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { dump } from 'js-yaml';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/bootstrap/setup-app';
import { buildOpenApiDocument } from '../src/bootstrap/setup-swagger';
import { AppConfig } from '../src/config/app-config';

const PLACEHOLDER_ENV = {
  SERVICE_NAME: 'media',
  S3_ENDPOINT: 'localhost',
  S3_PORT: '9000',
  S3_ACCESS_KEY: 'unused',
  S3_SECRET_KEY: 'unused',
  S3_BUCKET_PRIVATE: 'unused-private',
  S3_BUCKET_INTERNAL: 'unused-internal',
  S3_BUCKET_PUBLIC: 'unused-public',
  S3_BUCKET_TEMP: 'unused-temp',
  S3_AUTO_CREATE_BUCKETS: 'false',
  JOBS_ENABLED: 'false',
  SERVICE_VERSION: '0.1.0',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://localhost/unused',
  AUTH_JWKS_URL: process.env.AUTH_JWKS_URL ?? 'http://localhost/jwks.json',
  AUTH_ISSUER: process.env.AUTH_ISSUER ?? 'unused',
  AUTH_AUDIENCE: process.env.AUTH_AUDIENCE ?? 'unused',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
  SWAGGER_ENABLED: 'false',
};

async function exportOpenApi(): Promise<void> {
  Object.assign(process.env, PLACEHOLDER_ENV);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    bodyParser: false,
  });
  const config = app.get(AppConfig);
  setupApp(app, config);
  writeFileSync('openapi.yaml', dump(buildOpenApiDocument(app, config), { noRefs: true }));
  await app.close();
}

void exportOpenApi();
