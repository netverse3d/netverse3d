import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { CustomerRepository } from '../repositories/customer.repository';

@Injectable()
export class CustomerService {
  constructor(private readonly repository: CustomerRepository) {}

  async resolveOrCreate(tenantId: string, dto: CreateCustomerDto) {
    const customerRef = dto.customerRef ?? `cust_${randomBytes(6).toString('hex')}`;
    const existing = await this.repository.findByTenantAndRef(tenantId, customerRef);
    if (existing) return existing;
    return this.repository.create({
      customer_ref: customerRef,
      email: dto.email ?? null,
      full_name: dto.fullName ?? null,
      phone: dto.phone ?? null,
      tenants: { connect: { id: tenantId } },
    });
  }
}
