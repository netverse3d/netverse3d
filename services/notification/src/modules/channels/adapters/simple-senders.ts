import { Logger } from '@nestjs/common';
import { DeliveryReason } from '../../notifications/domain/delivery-reasons';
import {
  ChannelSender,
  OutboundMessage,
  PermanentSendError,
  SendReceipt,
} from '../ports/channel-sender';

export class DisabledChannelSender extends ChannelSender {
  send(message: OutboundMessage): Promise<SendReceipt> {
    return Promise.reject(
      new PermanentSendError(
        DeliveryReason.CHANNEL_DISABLED,
        `Channel ${message.channel} is not enabled on this service`,
      ),
    );
  }
}

export class LogChannelSender extends ChannelSender {
  private readonly logger = new Logger(LogChannelSender.name);

  send(message: OutboundMessage): Promise<SendReceipt> {
    this.logger.log(
      {
        deliveryId: message.deliveryId,
        channel: message.channel,
        eventType: message.eventType,
        subject: message.subject,
      },
      'delivery written to log instead of being sent',
    );
    return Promise.resolve({ providerMessageId: `log-${message.deliveryId}` });
  }
}
