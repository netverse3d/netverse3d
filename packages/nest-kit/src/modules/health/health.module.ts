import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { HEALTH_PROBES, HealthProbe } from './health-probe';
import { HealthService } from './services/health.service';

export interface HealthProbeOptions {
  imports?: ModuleMetadata['imports'];
  inject?: Array<string | symbol | (abstract new (...args: never[]) => unknown)>;
  useFactory: (...dependencies: never[]) => HealthProbe[];
}

@Module({
  controllers: [HealthController],
  providers: [HealthService, { provide: HEALTH_PROBES, useValue: [] }],
})
export class HealthModule {
  static withProbes(options: HealthProbeOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: options.imports ?? [],
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: HEALTH_PROBES,
          inject: options.inject ?? [],
          useFactory: options.useFactory as (...dependencies: unknown[]) => HealthProbe[],
        },
      ],
    };
  }
}
