import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { InboxModule } from '../inbox/inbox.module';
import { BrevoEmailSender } from './adapters/brevo-email-sender';
import { FirebasePushSender } from './adapters/firebase-push-sender';
import { InAppChannelSender } from './adapters/in-app-channel-sender';
import { DisabledChannelSender, LogChannelSender } from './adapters/simple-senders';
import { ChannelSender, EMAIL_SENDER, IN_APP_SENDER, PUSH_SENDER } from './ports/channel-sender';
import { ChannelRegistry } from './services/channel-registry';

function createEmailSender(config: AppConfig): ChannelSender {
  switch (config.email.provider) {
    case 'brevo':
      return new BrevoEmailSender(config);
    case 'log':
      return new LogChannelSender();
    case 'none':
      return new DisabledChannelSender();
  }
}

function createPushSender(config: AppConfig): ChannelSender {
  switch (config.push.provider) {
    case 'firebase':
      return new FirebasePushSender(config);
    case 'log':
      return new LogChannelSender();
    case 'none':
      return new DisabledChannelSender();
  }
}

@Module({
  imports: [InboxModule],
  providers: [
    { provide: EMAIL_SENDER, useFactory: createEmailSender, inject: [AppConfig] },
    { provide: PUSH_SENDER, useFactory: createPushSender, inject: [AppConfig] },
    { provide: IN_APP_SENDER, useClass: InAppChannelSender },
    ChannelRegistry,
  ],
  exports: [ChannelRegistry],
})
export class ChannelsModule {}
