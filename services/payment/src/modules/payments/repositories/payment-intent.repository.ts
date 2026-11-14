import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';

@Injectable()
export class PaymentIntentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Parameters<PrismaService['payment_intents']['create']>[0]['data']) {
    return this.prisma.payment_intents.create({ data, include: { attempts: true } });
  }

  findByPublicId(tenantId: string, publicId: string) {
    return this.prisma.payment_intents.findFirst({
      where: { tenant_id: tenantId, public_id: publicId },
      include: { attempts: { orderBy: { created_at: 'desc' } } },
    });
  }

  findByMerchantReference(tenantId: string, merchantReference: string) {
    return this.prisma.payment_intents.findUnique({
      where: {
        tenant_id_merchant_reference: {
          tenant_id: tenantId,
          merchant_reference: merchantReference,
        },
      },
      include: { attempts: { orderBy: { created_at: 'desc' } } },
    });
  }

  findAnyByPublicId(publicId: string) {
    return this.prisma.payment_intents.findUnique({
      where: { public_id: publicId },
      include: { attempts: { orderBy: { created_at: 'desc' } } },
    });
  }

  findById(id: string, db: PrismaDb = this.prisma) {
    return db.payment_intents.findUnique({
      where: { id },
      include: { attempts: { orderBy: { created_at: 'desc' } } },
    });
  }

  async lockForUpdate(id: string, db: PrismaDb) {
    await db.$queryRaw`SELECT id FROM payment_intents WHERE id = ${id}::uuid FOR NO KEY UPDATE`;
  }

  update(
    id: string,
    data: Parameters<PrismaService['payment_intents']['update']>[0]['data'],
    db: PrismaDb = this.prisma,
  ) {
    return db.payment_intents.update({
      where: { id },
      data,
      include: { attempts: { orderBy: { created_at: 'desc' } } },
    });
  }
}
