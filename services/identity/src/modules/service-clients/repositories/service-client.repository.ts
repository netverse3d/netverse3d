import { Injectable } from '@nestjs/common';
import { ServiceClient } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type ServiceClientRow = ServiceClient;

export interface NewServiceClient {
  name: string;
  secretHash: string;
  audiences: string[];
  permissions: string[];
}

@Injectable()
export class ServiceClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewServiceClient): Promise<ServiceClientRow> {
    return this.prisma.serviceClient.create({ data });
  }

  findByName(name: string): Promise<ServiceClientRow | null> {
    return this.prisma.serviceClient.findUnique({ where: { name } });
  }

  findById(id: string): Promise<ServiceClientRow | null> {
    return this.prisma.serviceClient.findUnique({ where: { id } });
  }

  findPage(skip: number, take: number): Promise<[ServiceClientRow[], number]> {
    return this.prisma.$transaction([
      this.prisma.serviceClient.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.serviceClient.count(),
    ]);
  }

  async replaceSecretOfActive(id: string, secretHash: string): Promise<number> {
    const { count } = await this.prisma.serviceClient.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { secretHash, secretRotatedAt: new Date() },
    });
    return count;
  }

  async activateRevoked(id: string, secretHash: string): Promise<number> {
    const { count } = await this.prisma.serviceClient.updateMany({
      where: { id, status: 'REVOKED' },
      data: { status: 'ACTIVE', secretHash, secretRotatedAt: new Date() },
    });
    return count;
  }

  async replaceGrantsOfActive(
    name: string,
    audiences: string[],
    permissions: string[],
  ): Promise<void> {
    await this.prisma.serviceClient.updateMany({
      where: { name, status: 'ACTIVE' },
      data: { audiences, permissions },
    });
  }

  async revokeActive(id: string): Promise<number> {
    const { count } = await this.prisma.serviceClient.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    return count;
  }
}
