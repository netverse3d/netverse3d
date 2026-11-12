import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { KitConfig } from '../../config/kit-config';
import { buildPinoHttpOptions } from './pino-options';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [KitConfig],
      useFactory: (config: KitConfig) => ({
        assignResponse: true,
        pinoHttp: buildPinoHttpOptions(config),
      }),
    }),
  ],
})
export class AppLoggerModule {}
