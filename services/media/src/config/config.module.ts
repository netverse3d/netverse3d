import { Global, Module } from '@nestjs/common';
import { config as loadDotEnv } from 'dotenv';
import { AppConfig } from './app-config';
import { parseEnv } from './env.schema';

function loadAppConfig(): AppConfig {
  loadDotEnv({ quiet: true });
  return new AppConfig(parseEnv(process.env));
}

@Global()
@Module({
  providers: [{ provide: AppConfig, useFactory: loadAppConfig }],
  exports: [AppConfig],
})
export class ConfigModule {}
