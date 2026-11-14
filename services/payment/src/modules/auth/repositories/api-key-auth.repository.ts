import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';

@Injectable()
export class ApiKeyAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPrefix(prefix: string) {
    return this.prisma.tenant_api_keys.findUnique({
      where: { key_prefix: prefix },
      include: { tenants: true },
    });
  }

  touchLastUsed(id: string) {
    return this.prisma.tenant_api_keys.update({
      where: { id },
      data: { last_used_at: new Date() },
    });
  }
}
