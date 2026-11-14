import { Global, Module } from '@nestjs/common';
import { Database } from '@netverse/nest-kit';
import { PrismaService } from './prisma.service';
import { TransactionRunner } from './transaction-runner';

@Global()
@Module({
  providers: [PrismaService, { provide: Database, useExisting: PrismaService }, TransactionRunner],
  exports: [PrismaService, Database, TransactionRunner],
})
export class PrismaModule {}
