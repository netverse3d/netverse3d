import { Injectable } from '@nestjs/common';
import { toIntentView } from '../views/payment.views';
import { PaymentIntentService } from './payment-intent.service';

@Injectable()
export class PaymentQueryService {
  constructor(private readonly paymentIntentService: PaymentIntentService) {}

  async getIntent(tenantId: string, publicId: string) {
    return toIntentView(await this.paymentIntentService.findOne(tenantId, publicId));
  }

  getIntentRow(tenantId: string, publicId: string) {
    return this.paymentIntentService.findOne(tenantId, publicId);
  }
}
