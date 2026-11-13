import { Injectable } from '@nestjs/common';
import { InboxRepository } from '../../inbox/repositories/inbox.repository';
import { ChannelSender, OutboundMessage, SendReceipt } from '../ports/channel-sender';

@Injectable()
export class InAppChannelSender extends ChannelSender {
  constructor(private readonly inbox: InboxRepository) {
    super();
  }

  async send(message: OutboundMessage): Promise<SendReceipt> {
    const item = await this.inbox.store({
      tenantId: message.tenantId,
      subject: message.destination,
      deliveryId: message.deliveryId,
      eventType: message.eventType,
      title: message.subject,
      body: message.body,
    });
    return { providerMessageId: item.id };
  }
}
