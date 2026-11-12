import 'reflect-metadata';
import { exportOpenApiFile } from '@netverse/nest-kit/testing';
import { AppModule } from '../src/app.module';

const PLACEHOLDER_ENV = {
  SERVICE_NAME: 'identity',
  KEY_ENCRYPTION_SECRET: '0'.repeat(64),
  OTP_HASH_SECRET: '0'.repeat(32),
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

Object.assign(process.env, PLACEHOLDER_ENV);
void exportOpenApiFile(AppModule, 'openapi.yaml');
