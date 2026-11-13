import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryChannelName } from '../../notifications/domain/channels';
import { ChannelSender, EMAIL_SENDER, IN_APP_SENDER, PUSH_SENDER } from '../ports/channel-sender';

@Injectable()
export class ChannelRegistry {
  constructor(
    @Inject(EMAIL_SENDER) private readonly email: ChannelSender,
    @Inject(PUSH_SENDER) private readonly push: ChannelSender,
    @Inject(IN_APP_SENDER) private readonly inApp: ChannelSender,
  ) {}

  senderFor(channel: DeliveryChannelName): ChannelSender {
    switch (channel) {
      case 'EMAIL':
        return this.email;
      case 'PUSH':
        return this.push;
      case 'IN_APP':
        return this.inApp;
    }
  }
}
