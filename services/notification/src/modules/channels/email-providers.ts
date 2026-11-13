import { brevoProvider } from './adapters/brevo-email-sender';
import { gmailApiProvider } from './adapters/gmail-api-email-sender';
import { resendProvider } from './adapters/resend-email-sender';
import { smtpProvider } from './adapters/smtp-email-sender';
import { EmailProvider } from './ports/email-provider';

export const EMAIL_PROVIDERS: readonly EmailProvider[] = [
  brevoProvider,
  resendProvider,
  smtpProvider,
  gmailApiProvider,
];

export const EMAIL_PROVIDER_LOG = 'log';
export const EMAIL_PROVIDER_NONE = 'none';

export function emailProviderChoices(): string[] {
  return [
    EMAIL_PROVIDER_NONE,
    EMAIL_PROVIDER_LOG,
    ...EMAIL_PROVIDERS.map((provider) => provider.name),
  ];
}

export function findEmailProvider(name: string): EmailProvider | undefined {
  return EMAIL_PROVIDERS.find((provider) => provider.name === name);
}
