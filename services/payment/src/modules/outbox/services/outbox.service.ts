import { Injectable } from '@nestjs/common';
import { PageResponseDto } from '@netverse/nest-kit';
import { DeadDeliveryQueryDto } from '../dto/outbox.dto';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { PaymentOutboxDeliveryRepository } from '../repositories/payment-outbox-delivery.repository';
import { PaymentOutboxRepository } from '../repositories/payment-outbox.repository';
import { OutboxDeliveryService } from './outbox-delivery.service';

@Injectable()
export class OutboxService {
  constructor(
    private readonly repository: PaymentOutboxRepository,
    private readonly deliveryRepository: PaymentOutboxDeliveryRepository,
    private readonly deliveryService: OutboxDeliveryService,
  ) {}

  async dispatchById(id: bigint) {
    const row = await this.repository.findById(id);
    if (!row) throw new AppException(PaymentErrorCode.OUTBOX_EVENT_NOT_FOUND);
    return this.deliveryService.dispatchEvent(id);
  }

  dispatchPending(limit = 50) {
    return this.deliveryService.runOnce(limit);
  }

  async listDeadDeliveries(query: DeadDeliveryQueryDto) {
    const [rows, total] = await this.deliveryRepository.listDead(
      query.skip,
      query.take,
      query.tenantId,
    );
    return PageResponseDto.of(rows, query, total);
  }

  async retryDeadDelivery(id: string) {
    if (!(await this.deliveryRepository.requeueDead(id))) {
      throw new AppException(PaymentErrorCode.DEAD_DELIVERY_NOT_FOUND);
    }
    return { id, requeued: true };
  }
}
