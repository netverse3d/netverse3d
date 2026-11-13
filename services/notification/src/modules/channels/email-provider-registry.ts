import { AppConfig } from '../../config/app-config';
import { DisabledChannelSender, LogChannelSender } from './adapters/simple-senders';
import { EMAIL_PROVIDER_LOG, findEmailProvider } from './email-providers';
import { ChannelSender } from './ports/channel-sender';

export function createEmailSender(config: AppConfig): ChannelSender {
  const { provider: name, fromAddress, fromName, settings } = config.email;
  if (name === EMAIL_PROVIDER_LOG) {
    return new LogChannelSender();
  }
  const provider = findEmailProvider(name);
  if (!provider || !fromAddress) {
    return new DisabledChannelSender();
  }
  return provider.create(settings, {
    fromAddress,
    fromName,
    timeoutMs: config.providers.timeoutMs,
  });
}
