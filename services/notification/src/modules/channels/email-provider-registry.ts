import { AppConfig } from '../../config/app-config';
import { DisabledChannelSender, LogChannelSender } from './adapters/simple-senders';
import { EMAIL_PROVIDER_LOG, EMAIL_PROVIDER_NONE, findEmailProvider } from './email-providers';
import { ChannelSender } from './ports/channel-sender';

export function createEmailSender(config: AppConfig): ChannelSender {
  const { provider: name, fromAddress, fromName, settings } = config.email;
  if (name === EMAIL_PROVIDER_LOG) {
    return new LogChannelSender();
  }
  if (name === EMAIL_PROVIDER_NONE) {
    return new DisabledChannelSender();
  }
  const provider = findEmailProvider(name);
  if (!provider) {
    throw new Error(`Unknown email provider ${name}`);
  }
  if (!fromAddress) {
    throw new Error(`EMAIL_FROM_ADDRESS is required when EMAIL_PROVIDER is ${name}`);
  }
  return provider.create(settings, {
    fromAddress,
    fromName,
    timeoutMs: config.providers.timeoutMs,
  });
}
