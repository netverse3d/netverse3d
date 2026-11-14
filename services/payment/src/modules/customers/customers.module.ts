import { Module } from '@nestjs/common';
import { CustomerController } from './controllers/customer.controller';
import { CustomerRepository } from './repositories/customer.repository';
import { CustomerService } from './services/customer.service';

@Module({
  controllers: [CustomerController],
  providers: [CustomerRepository, CustomerService],
  exports: [CustomerRepository, CustomerService],
})
export class CustomersModule {}
