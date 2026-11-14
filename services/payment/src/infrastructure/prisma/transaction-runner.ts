import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/infrastructure/prisma/client';
import { PrismaService } from './prisma.service';

export type PrismaDb = Prisma.TransactionClient;

@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: PrismaDb) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
