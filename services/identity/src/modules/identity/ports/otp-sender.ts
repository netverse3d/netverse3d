export interface OtpMessage {
  email: string;
  purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
  code: string;
  expiresInMinutes: number;
}

export abstract class OtpSender {
  abstract send(message: OtpMessage): Promise<void>;
}
