import { createTransport } from 'nodemailer';
import { z } from 'zod';
import { DeliveryReason } from '../../notifications/domain/delivery-reasons';
import {
  ChannelSender,
  OutboundMessage,
  PermanentSendError,
  ProviderConfigurationError,
  SendReceipt,
} from '../ports/channel-sender';
import { EmailProvider, EmailSenderContext, formatSender } from '../ports/email-provider';

const FIRST_PERMANENT_REPLY = 500;
const LAST_PERMANENT_REPLY = 599;
const FAILURE_CODE = /^[A-Z_]+$/;
const CREDENTIALS_REFUSED = 'EAUTH';
const MESSAGE_STAGES: ReadonlySet<string> = new Set(['RCPT TO', 'DATA']);

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

export interface SmtpMail {
  from: string;
  to: string;
  subject: string;
  html: string;
  messageId: string;
}

export interface SmtpTransport {
  sendMail(mail: SmtpMail): Promise<{ messageId?: string }>;
}

export type SmtpTransportFactory = (settings: SmtpSettings, timeoutMs: number) => SmtpTransport;

type SmtpOutcome =
  | { accepted: true; messageId?: string }
  | { accepted: false; replyCode: number | null; failureCode: string; aboutTheMessage: boolean };

function connect(settings: SmtpSettings, timeoutMs: number): SmtpTransport {
  return createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    requireTLS: !settings.secure && settings.user !== undefined,
    auth: settings.user ? { user: settings.user, pass: settings.password ?? '' } : undefined,
    connectionTimeout: timeoutMs / 2,
    greetingTimeout: timeoutMs / 2,
    socketTimeout: timeoutMs,
  });
}

function failureOf(error: unknown): SmtpOutcome {
  const { responseCode, code, command } = (error ?? {}) as {
    responseCode?: unknown;
    code?: unknown;
    command?: unknown;
  };
  return {
    accepted: false,
    replyCode: typeof responseCode === 'number' ? responseCode : null,
    failureCode: typeof code === 'string' && FAILURE_CODE.test(code) ? code : 'no error code',
    aboutTheMessage: typeof command === 'string' && MESSAGE_STAGES.has(command),
  };
}

export class SmtpEmailSender extends ChannelSender {
  private readonly transport: SmtpTransport;
  private readonly domain: string;

  constructor(
    settings: SmtpSettings,
    private readonly context: EmailSenderContext,
    createSmtpTransport: SmtpTransportFactory = connect,
  ) {
    super();
    this.transport = createSmtpTransport(settings, context.timeoutMs);
    this.domain = context.fromAddress.split('@').pop() ?? 'localhost';
  }

  async send(message: OutboundMessage): Promise<SendReceipt> {
    const outcome = await this.transport
      .sendMail({
        from: formatSender(this.context),
        to: message.destination,
        subject: message.subject,
        html: message.body,
        messageId: `<${message.deliveryId}@${this.domain}>`,
      })
      .then((sent): SmtpOutcome => ({ accepted: true, messageId: sent.messageId }), failureOf);
    if (outcome.accepted) {
      return { providerMessageId: outcome.messageId };
    }
    const { replyCode, failureCode, aboutTheMessage } = outcome;
    if (failureCode === CREDENTIALS_REFUSED) {
      throw new ProviderConfigurationError('SMTP server refused the credentials');
    }
    if (replyCode === null) {
      throw new Error(`SMTP server could not be reached (${failureCode})`);
    }
    if (
      aboutTheMessage &&
      replyCode >= FIRST_PERMANENT_REPLY &&
      replyCode <= LAST_PERMANENT_REPLY
    ) {
      throw new PermanentSendError(
        DeliveryReason.PROVIDER_REJECTED,
        `SMTP server rejected the message with reply ${replyCode}`,
      );
    }
    throw new Error(`SMTP server answered ${replyCode} (${failureCode})`);
  }
}

const CREDENTIAL_PAIRS: readonly (readonly [string, string])[] = [
  ['SMTP_USER', 'SMTP_PASSWORD'],
  ['SMTP_PASSWORD', 'SMTP_USER'],
];

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

export const smtpProvider: EmailProvider = {
  name: 'smtp',
  env: {
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_SECURE: booleanFlag.optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
  },
  required: ['SMTP_HOST', 'SMTP_PORT'],
  secrets: ['SMTP_PASSWORD'],
  refine: (settings, context) => {
    for (const [name, other] of CREDENTIAL_PAIRS) {
      if (settings[name] === undefined && settings[other] !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [name],
          message: `is required when ${other} is set`,
        });
      }
    }
  },
  create: (settings, context) =>
    new SmtpEmailSender(
      {
        host: settings.SMTP_HOST as string,
        port: settings.SMTP_PORT as number,
        secure: (settings.SMTP_SECURE as boolean | undefined) ?? false,
        user: settings.SMTP_USER as string | undefined,
        password: settings.SMTP_PASSWORD as string | undefined,
      },
      context,
    ),
};
