import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../../config/app-config';
import { buildPinoHttpOptions } from './pino-options';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        assignResponse: true,
        pinoHttp: buildPinoHttpOptions(config),
      }),
    }),
  ],
})
export class AppLoggerModule {}
