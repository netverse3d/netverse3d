import { Global, Module } from '@nestjs/common';
import { Database } from '@netverse/nest-kit';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, { provide: Database, useExisting: PrismaService }],
  exports: [PrismaService, Database],
})
export class PrismaModule {}
