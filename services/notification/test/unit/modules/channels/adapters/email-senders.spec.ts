import { BrevoEmailSender } from '../../../../../src/modules/channels/adapters/brevo-email-sender';
import { GmailApiEmailSender } from '../../../../../src/modules/channels/adapters/gmail-api-email-sender';
import { ResendEmailSender } from '../../../../../src/modules/channels/adapters/resend-email-sender';
import {
  SmtpEmailSender,
  SmtpMail,
} from '../../../../../src/modules/channels/adapters/smtp-email-sender';
import {
  describeEmailSenderContract,
  EMAIL_MESSAGE,
  SENDER_CONTEXT,
} from './email-sender-contract';

const API_KEY = `unit-${'k'.repeat(20)}`;
const CLIENT_SECRET = `unit-${'c'.repeat(20)}`;
const REFRESH_TOKEN = `unit-${'r'.repeat(20)}`;
const SMTP_PASSWORD = `unit-${'p'.repeat(20)}`;

type FetchCall = [string, RequestInit];

function respond(status: number, body: unknown = {}): jest.SpyInstance {
  return jest
    .spyOn(global, 'fetch')
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
}

function unreachable(): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
}

const callTo = (mock: jest.SpyInstance, fragment: string) =>
  mock.mock.calls.find(([url]) => String(url).includes(fragment)) as FetchCall;

describeEmailSenderContract({
  provider: 'brevo',
  secrets: [API_KEY],
  sender: () => new BrevoEmailSender(API_KEY, SENDER_CONTEXT),
  accept: (messageId) => void respond(201, { messageId }),
  rejectMessage: () => void respond(400),
  failTemporarily: () => void respond(500),
  beUnreachable: () => void unreachable(),
});

describe('gửi email qua Brevo', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gửi thân HTML đúng người nhận, kèm khoá ở header riêng của Brevo', async () => {
    const fetchMock = respond(201, { messageId: 'id' });
    await new BrevoEmailSender(API_KEY, SENDER_CONTEXT).send(EMAIL_MESSAGE);
    const [url, init] = fetchMock.mock.calls[0] as FetchCall;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe(API_KEY);
    expect(JSON.parse(init.body as string)).toMatchObject({
      sender: { email: 'from@example.test', name: 'Sender' },
      to: [{ email: 'user@example.test' }],
      subject: 'Subject',
      htmlContent: '<p>Body</p>',
    });
  });

  it('lỗi 429 là tạm thời', async () => {
    respond(429);
    await expect(new BrevoEmailSender(API_KEY, SENDER_CONTEXT).send(EMAIL_MESSAGE)).rejects.toThrow(
      'Brevo answered 429',
    );
  });
});

describeEmailSenderContract({
  provider: 'resend',
  secrets: [API_KEY],
  sender: () => new ResendEmailSender(API_KEY, SENDER_CONTEXT),
  accept: (id) => void respond(200, { id }),
  rejectMessage: () => void respond(422),
  failTemporarily: () => void respond(503),
  beUnreachable: () => void unreachable(),
});

describe('gửi email qua Resend', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gửi đúng địa chỉ, người gửi kèm tên, và dùng mã lần gửi làm khoá chống trùng', async () => {
    const fetchMock = respond(200, { id: 'id' });
    await new ResendEmailSender(API_KEY, SENDER_CONTEXT).send(EMAIL_MESSAGE);
    const [url, init] = fetchMock.mock.calls[0] as FetchCall;
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://api.resend.com/emails');
    expect(headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers['idempotency-key']).toBe(EMAIL_MESSAGE.deliveryId);
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Sender <from@example.test>',
      to: ['user@example.test'],
      subject: 'Subject',
      html: '<p>Body</p>',
    });
  });

  it('khoá sai là lỗi cấu hình, được coi là tạm thời để thư không bị bỏ', async () => {
    respond(401);
    await expect(
      new ResendEmailSender(API_KEY, SENDER_CONTEXT).send(EMAIL_MESSAGE),
    ).rejects.toThrow('Resend answered 401');
  });
});

class FakeSmtp {
  readonly sent: SmtpMail[] = [];
  outcome: { messageId?: string } | Error = { messageId: 'smtp-id' };

  sendMail(mail: SmtpMail): Promise<{ messageId?: string }> {
    this.sent.push(mail);
    return this.outcome instanceof Error
      ? Promise.reject(this.outcome)
      : Promise.resolve(this.outcome);
  }
}

const smtpReply = (responseCode: number) =>
  Object.assign(new Error(`reply ${responseCode} for ${SMTP_PASSWORD}`), { responseCode });
const smtp = new FakeSmtp();
const smtpSender = () =>
  new SmtpEmailSender(
    {
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      user: 'mailer',
      password: SMTP_PASSWORD,
    },
    SENDER_CONTEXT,
    () => smtp,
  );

describeEmailSenderContract({
  provider: 'smtp',
  secrets: [SMTP_PASSWORD],
  sender: smtpSender,
  accept: (messageId) => void (smtp.outcome = { messageId }),
  rejectMessage: () => void (smtp.outcome = smtpReply(550)),
  failTemporarily: () => void (smtp.outcome = smtpReply(451)),
  beUnreachable: () => void (smtp.outcome = new Error('connect ECONNREFUSED')),
});

describe('gửi email qua SMTP', () => {
  it('gửi đúng người nhận, và mã thư gắn với mã lần gửi để máy chủ nhận ra thư lặp', async () => {
    smtp.sent.length = 0;
    smtp.outcome = { messageId: 'smtp-id' };
    await smtpSender().send(EMAIL_MESSAGE);
    expect(smtp.sent).toEqual([
      {
        from: 'Sender <from@example.test>',
        to: 'user@example.test',
        subject: 'Subject',
        html: '<p>Body</p>',
        messageId: `<${EMAIL_MESSAGE.deliveryId}@example.test>`,
      },
    ]);
  });

  it('nối tới máy chủ bằng đúng cấu hình và hạn chờ', () => {
    const factory = jest.fn(() => smtp);
    const settings = { host: 'mail.internal', port: 1025, secure: false };
    new SmtpEmailSender(settings, SENDER_CONTEXT, factory);
    expect(factory).toHaveBeenCalledWith(settings, SENDER_CONTEXT.timeoutMs);
  });
});

const gmailCredentials = {
  clientId: 'client.apps.example.test',
  clientSecret: CLIENT_SECRET,
  refreshToken: REFRESH_TOKEN,
};

function gmail(sendStatus: number, sendBody: unknown = {}, tokenStatus = 200): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockImplementation((input) =>
    Promise.resolve(
      String(input).includes('oauth2')
        ? new Response(JSON.stringify({ access_token: 'access-1', expires_in: 3600 }), {
            status: tokenStatus,
          })
        : new Response(JSON.stringify(sendBody), { status: sendStatus }),
    ),
  );
}

describeEmailSenderContract({
  provider: 'gmail-api',
  secrets: [CLIENT_SECRET, REFRESH_TOKEN],
  sender: () => new GmailApiEmailSender(gmailCredentials, SENDER_CONTEXT),
  accept: (id) => void gmail(200, { id }),
  rejectMessage: () => void gmail(400),
  failTemporarily: () => void gmail(503),
  beUnreachable: () => void unreachable(),
});

describe('gửi email qua Gmail API', () => {
  afterEach(() => jest.restoreAllMocks());

  it('đổi refresh token lấy access token rồi gửi thư đã mã hoá, kèm đúng người gửi và người nhận', async () => {
    const fetchMock = gmail(200, { id: 'gmail-id' });
    await new GmailApiEmailSender(gmailCredentials, SENDER_CONTEXT).send(EMAIL_MESSAGE);

    const [, tokenInit] = callTo(fetchMock, 'oauth2');
    const form = new URLSearchParams(String(tokenInit.body));
    expect(form.get('grant_type')).toBe('refresh_token');
    expect(form.get('refresh_token')).toBe(REFRESH_TOKEN);

    const [sendUrl, sendInit] = callTo(fetchMock, 'messages/send');
    expect(sendUrl).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect((sendInit.headers as Record<string, string>).authorization).toBe('Bearer access-1');
    const raw = Buffer.from(
      JSON.parse(sendInit.body as string).raw as string,
      'base64url',
    ).toString();
    expect(raw).toContain('To: user@example.test');
    expect(raw).toContain('From: Sender <from@example.test>');
    expect(raw).toContain('Subject: Subject');
  });

  it('dùng lại access token cho các lần gửi sau, và các lần gửi đồng thời chỉ xin token một lần', async () => {
    const fetchMock = gmail(200, { id: 'gmail-id' });
    const sender = new GmailApiEmailSender(gmailCredentials, SENDER_CONTEXT);
    await Promise.all([sender.send(EMAIL_MESSAGE), sender.send(EMAIL_MESSAGE)]);
    await sender.send(EMAIL_MESSAGE);
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth2'));
    expect(tokenCalls).toHaveLength(1);
  });

  it('Google không cấp token thì là lỗi tạm thời và lần sau xin lại', async () => {
    const sender = new GmailApiEmailSender(gmailCredentials, SENDER_CONTEXT);
    gmail(200, {}, 400);
    await expect(sender.send(EMAIL_MESSAGE)).rejects.toThrow('did not issue an access token');
    jest.restoreAllMocks();
    gmail(200, { id: 'gmail-id' });
    await expect(sender.send(EMAIL_MESSAGE)).resolves.toEqual({ providerMessageId: 'gmail-id' });
  });

  it('access token bị từ chối thì bỏ token cũ để lần sau xin mới', async () => {
    const sender = new GmailApiEmailSender(gmailCredentials, SENDER_CONTEXT);
    gmail(401);
    await expect(sender.send(EMAIL_MESSAGE)).rejects.toThrow('Gmail answered 401');
    jest.restoreAllMocks();
    const fetchMock = gmail(200, { id: 'gmail-id' });
    await sender.send(EMAIL_MESSAGE);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth2'))).toHaveLength(1);
  });
});
