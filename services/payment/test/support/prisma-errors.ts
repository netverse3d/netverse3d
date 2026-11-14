import { Prisma } from '@app/infrastructure/prisma/client';

export const PrismaKnownError = Prisma.PrismaClientKnownRequestError;

export function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '7' });
}
