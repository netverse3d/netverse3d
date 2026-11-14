import { createHmac } from 'crypto';
import {
  ProviderAccountContext,
  ProviderRuntimeConfig,
  ProviderWebhookRequest,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { formatVnpayDate } from '@app/modules/providers/vnpay/vnpay-date.util';
import {
  phpUrlEncode,
  signVnpayParams,
  verifyVnpayParams,
  vnpayCanonicalQuery,
} from '@app/modules/providers/vnpay/vnpay-signature.util';
import { vnpayAck } from '@app/modules/providers/vnpay/vnpay-mapper';
import { VnpayProvider } from '@app/modules/providers/vnpay/vnpay.provider';

const SECRET = 'A'.repeat(32);
const CONFIG: ProviderRuntimeConfig = {
  httpTimeoutMs: 1000,
  expiryGraceMinutes: 10,
  serverIp: '198.51.100.10',
  vnpayPaymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  vnpayApiUrl: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  payosApiBaseUrl: 'https://payos.invalid',
  payosOrderCodeOffset: 0,
};
const ACCOUNT: ProviderAccountContext = {
  id: 'pa-vnp',
  tenant_id: 'tenant-1',
  externalAccountRef: 'TESTTMN1',
  credentials: { hashSecret: SECRET },
  config: null,
};

function checkoutInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-1',
    paymentIntentId: 'intent-1',
    publicId: 'pi_1',
    attemptId: 'attempt-1',
    orderNumber: 1234n,
    createdAt: new Date('2026-10-18T17:30:05Z'),
    amountMinor: 49000n,
    currency: 'VND',
    title: 'Pro',
    returnUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_1',
    providerAccount: ACCOUNT,
    providerOrderRef: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
    context: { clientIp: '203.0.113.7' },
    ...overrides,
  };
}

function ipnQuery(fields: Record<string, string>, secret = SECRET) {
  const { query, secureHash } = signVnpayParams(fields, secret);
  return `${query}&vnp_SecureHashType=HmacSHA512&vnp_SecureHash=${secureHash}`;
}

function ipnRequest(rawQuery: string): ProviderWebhookRequest {
  return { method: 'GET', query: {}, rawQuery, headers: {}, rawBody: '', body: undefined };
}

const PAID_IPN = {
  vnp_Amount: '4900000',
  vnp_BankCode: 'NCB',
  vnp_BankTranNo: 'VNP14000001',
  vnp_CardType: 'ATM',
  vnp_OrderInfo: 'Payment 1234',
  vnp_PayDate: '20261019003500',
  vnp_ResponseCode: '00',
  vnp_TmnCode: 'TESTTMN1',
  vnp_TransactionNo: '14000001',
  vnp_TransactionStatus: '00',
  vnp_TxnRef: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
};

describe('VNPAY — mã hoá + ngày giờ', () => {
  it('phpUrlEncode: dấu cách -> +, ký tự PHP urlencode mã hoá mà encodeURIComponent bỏ qua', () => {
    expect(phpUrlEncode('Payment 1234')).toBe('Payment+1234');
    expect(phpUrlEncode("a~b*c!d'e(f)")).toBe('a%7Eb%2Ac%21d%27e%28f%29');
    expect(phpUrlEncode('https://x.vn/a?b=c&d=e')).toBe('https%3A%2F%2Fx.vn%2Fa%3Fb%3Dc%26d%3De');
  });

  it('ngày giờ theo Asia/Ho_Chi_Minh qua nửa đêm UTC', () => {
    expect(formatVnpayDate(new Date('2026-10-18T17:30:05Z'))).toBe('20261019003005');
    expect(formatVnpayDate(new Date('2026-12-31T23:59:59Z'))).toBe('20270101065959');
    expect(formatVnpayDate(new Date('2026-01-01T00:00:00Z'))).toBe('20260101070000');
  });

  it('chuỗi ký: sắp khoá, bỏ vnp_SecureHash/Type, HMAC-SHA512 trên chuỗi đã mã hoá', () => {
    const params = {
      vnp_TxnRef: 'abc',
      vnp_Amount: '100',
      vnp_OrderInfo: 'Thanh toan 1',
      vnp_SecureHashType: 'HmacSHA512',
    };
    const canonical = vnpayCanonicalQuery(params);
    expect(canonical).toBe('vnp_Amount=100&vnp_OrderInfo=Thanh+toan+1&vnp_TxnRef=abc');
    expect(signVnpayParams(params, SECRET).secureHash).toBe(
      createHmac('sha512', SECRET).update(canonical).digest('hex'),
    );
  });
});

describe('VnpayProvider.createCheckout', () => {
  const provider = new VnpayProvider(CONFIG);

  it('URL ký đúng: vnp_Amount = VND x 100, ngày GMT+7, IP người trả, OrderInfo ASCII, hết hạn theo cấu hình', async () => {
    const result = await provider.createCheckout(checkoutInput());
    const url = new URL(result.checkoutUrl!);
    const params = Object.fromEntries(url.searchParams.entries());

    expect(`${url.origin}${url.pathname}`).toBe(CONFIG.vnpayPaymentUrl);
    expect(params).toMatchObject({
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: 'TESTTMN1',
      vnp_Amount: '4900000',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
      vnp_OrderInfo: 'Payment 1234',
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_IpAddr: '203.0.113.7',
      vnp_CreateDate: '20261019003005',
      vnp_ExpireDate: '20261019004505',
      vnp_ReturnUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_1',
    });
    expect(result.checkoutUrl).toContain('vnp_OrderInfo=Payment+1234');
    expect(verifyVnpayParams(params, [SECRET])).toBe(true);
    expect(result).toMatchObject({
      status: 'requires_action',
      providerOrderId: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
      nextAction: { type: 'redirect', url: result.checkoutUrl },
      providerData: {
        createDate: '20261019003005',
        txnRef: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
        tmnCode: 'TESTTMN1',
      },
      expiresAt: new Date('2026-10-18T17:45:05Z'),
    });
    expect(result.checkoutUrl!.length).toBeGreaterThan(500);
  });

  it('thiếu IP người trả -> 422 PAYER_IP_REQUIRED', async () => {
    await expect(
      provider.createCheckout(checkoutInput({ context: { clientIp: null } })),
    ).rejects.toMatchObject({
      status: 422,
      details: { reason: 'PAYER_IP_REQUIRED' },
    });
  });

  it('tiền tệ khác VND -> 422', async () => {
    await expect(provider.createCheckout(checkoutInput({ currency: 'USD' }))).rejects.toMatchObject(
      { status: 422 },
    );
  });

  it('account thiếu hashSecret -> 422, không dựng URL', async () => {
    await expect(
      provider.createCheckout(checkoutInput({ providerAccount: { ...ACCOUNT, credentials: {} } })),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('VnpayProvider — IPN', () => {
  const provider = new VnpayProvider(CONFIG);

  it('inspect: accountRef = vnp_TmnCode, merchantReference = vnp_TxnRef, KHÔNG dùng vnp_TransactionNo để tra attempt', () => {
    expect(provider.inspectWebhook(ipnRequest(ipnQuery(PAID_IPN)))).toEqual({
      accountRef: 'TESTTMN1',
      merchantReference: PAID_IPN.vnp_TxnRef,
      providerPaymentId: null,
      paymentIntentPublicId: null,
    });
  });

  it('chữ ký đúng -> verified; sửa số tiền -> invalid; sai TmnCode -> invalid; không có account -> no_secret', () => {
    const raw = ipnQuery(PAID_IPN);
    expect(provider.verifyWebhook(ipnRequest(raw), ACCOUNT)).toMatchObject({ outcome: 'verified' });
    expect(
      provider.verifyWebhook(
        ipnRequest(raw.replace('vnp_Amount=4900000', 'vnp_Amount=100')),
        ACCOUNT,
      ),
    ).toMatchObject({ outcome: 'invalid' });
    expect(
      provider.verifyWebhook(
        ipnRequest(ipnQuery({ ...PAID_IPN, vnp_TmnCode: 'OTHER001' })),
        ACCOUNT,
      ),
    ).toMatchObject({ outcome: 'invalid' });
    expect(
      provider.verifyWebhook(ipnRequest(ipnQuery(PAID_IPN, 'wrong-secret-0000')), ACCOUNT),
    ).toMatchObject({ outcome: 'invalid' });
    expect(provider.verifyWebhook(ipnRequest(raw), null)).toEqual({ outcome: 'no_secret' });
  });

  it('xoay khoá: chữ ký bằng previousHashSecret vẫn verify được', () => {
    const account = {
      ...ACCOUNT,
      credentials: { hashSecret: 'NEWSECRETNEWSECRET', previousHashSecret: SECRET },
    };
    expect(provider.verifyWebhook(ipnRequest(ipnQuery(PAID_IPN)), account)).toMatchObject({
      outcome: 'verified',
    });
  });

  it('00/00 -> succeeded, số tiền chia 100, mã sự kiện mang mã account', async () => {
    await expect(provider.normalizeWebhook(ipnRequest(ipnQuery(PAID_IPN)))).resolves.toMatchObject({
      providerEventId: `vnpay:TESTTMN1:${PAID_IPN.vnp_TxnRef}:00:00`,
      status: 'succeeded',
      amountMinor: 49000n,
      currency: 'VND',
      providerPaymentId: '14000001',
      providerOrderId: PAID_IPN.vnp_TxnRef,
      failureCode: null,
    });
  });

  it('24 -> canceled; 51 -> failed kèm thông điệp; vnp_TransactionNo = 0 -> null', async () => {
    await expect(
      provider.normalizeWebhook(
        ipnRequest(
          ipnQuery({
            ...PAID_IPN,
            vnp_ResponseCode: '24',
            vnp_TransactionStatus: '02',
            vnp_TransactionNo: '0',
          }),
        ),
      ),
    ).resolves.toMatchObject({
      status: 'canceled',
      failureCode: '24',
      failureMessage: 'The payer cancelled the transaction',
      providerPaymentId: null,
    });
    await expect(
      provider.normalizeWebhook(
        ipnRequest(ipnQuery({ ...PAID_IPN, vnp_ResponseCode: '51', vnp_TransactionStatus: '02' })),
      ),
    ).resolves.toMatchObject({
      status: 'failed',
      failureCode: '51',
      failureMessage: 'The account has insufficient funds',
    });
  });

  it('vnp_Amount không chia hết 100 -> 400', async () => {
    await expect(
      provider.normalizeWebhook(ipnRequest(ipnQuery({ ...PAID_IPN, vnp_Amount: '4900050' }))),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    [{ kind: 'processed', status: 'succeeded' }, '00'],
    [{ kind: 'duplicate', previousStatus: 'processed', previousReason: null }, '02'],
    [{ kind: 'duplicate', previousStatus: 'ignored', previousReason: 'TARGET_NOT_FOUND' }, '01'],
    [{ kind: 'duplicate', previousStatus: 'ignored', previousReason: 'AMOUNT_MISMATCH' }, '04'],
    [{ kind: 'ignored', reason: 'TARGET_NOT_FOUND' }, '01'],
    [{ kind: 'ignored', reason: 'AMOUNT_MISMATCH' }, '04'],
    [{ kind: 'ignored', reason: 'NO_STATE_CHANGE' }, '02'],
    [{ kind: 'ignored', reason: 'STALE_ATTEMPT_TRANSITION' }, '02'],
    [{ kind: 'rejected', statusCode: 401, reason: 'sig' }, '97'],
    [{ kind: 'rejected', statusCode: 400, reason: 'bad' }, '99'],
    [{ kind: 'rejected', statusCode: 500, reason: 'db' }, '99'],
  ] as const)('ACK %p -> RspCode %s, luôn HTTP 200', (outcome, code) => {
    const ack = vnpayAck(outcome);
    expect(ack.httpStatus).toBe(200);
    expect(ack.body).toMatchObject({ RspCode: code });
  });
});

describe('VnpayProvider — querydr / refund', () => {
  const provider = new VnpayProvider(CONFIG);
  const QUERY_FIELDS = [
    'vnp_ResponseId',
    'vnp_Command',
    'vnp_ResponseCode',
    'vnp_Message',
    'vnp_TmnCode',
    'vnp_TxnRef',
    'vnp_Amount',
    'vnp_BankCode',
    'vnp_PayDate',
    'vnp_TransactionNo',
    'vnp_TransactionType',
    'vnp_TransactionStatus',
    'vnp_OrderInfo',
    'vnp_PromotionCode',
    'vnp_PromotionAmount',
  ];

  function signedResponse(data: Record<string, string>, fields = QUERY_FIELDS) {
    const hash = createHmac('sha512', SECRET)
      .update(fields.map((f) => data[f] ?? '').join('|'))
      .digest('hex');
    return { ...data, vnp_SecureHash: hash };
  }

  function queryInput(overrides: Record<string, unknown> = {}) {
    return {
      tenantId: 'tenant-1',
      publicId: 'pi_1',
      attemptId: 'attempt-1',
      orderNumber: 1234n,
      providerOrderId: PAID_IPN.vnp_TxnRef,
      providerPaymentId: null,
      providerData: { txnRef: PAID_IPN.vnp_TxnRef, createDate: '20261019003005' },
      amountMinor: 49000n,
      currency: 'VND',
      attemptCreatedAt: new Date('2026-10-18T17:30:05Z'),
      attemptExpiresAt: new Date(Date.now() + 60_000),
      providerAccount: ACCOUNT,
      context: { clientIp: '198.51.100.10' },
      ...overrides,
    };
  }

  let fetchSpy: jest.SpyInstance;
  afterEach(() => fetchSpy?.mockRestore());

  function respond(body: unknown) {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  }

  it('querydr ký đúng chuỗi | theo thứ tự cố định, vnp_TransactionDate = ngày tạo attempt', async () => {
    respond(
      signedResponse({
        vnp_ResponseId: 'r1',
        vnp_Command: 'querydr',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'TESTTMN1',
        vnp_TxnRef: PAID_IPN.vnp_TxnRef,
        vnp_Amount: '4900000',
        vnp_TransactionNo: '14000001',
        vnp_TransactionStatus: '00',
      }),
    );

    const state = await provider.queryPayment(queryInput());

    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    const expected = createHmac('sha512', SECRET)
      .update(
        [
          body.vnp_RequestId,
          '2.1.0',
          'querydr',
          'TESTTMN1',
          PAID_IPN.vnp_TxnRef,
          '20261019003005',
          body.vnp_CreateDate,
          '198.51.100.10',
          body.vnp_OrderInfo,
        ].join('|'),
      )
      .digest('hex');
    expect(body.vnp_SecureHash).toBe(expected);
    expect(body.vnp_TransactionDate).toBe('20261019003005');
    expect(body.vnp_RequestId).toMatch(/^[0-9a-f]{32}$/);
    expect(state).toMatchObject({
      status: 'succeeded',
      amountMinor: 49000n,
      providerPaymentId: '14000001',
    });
  });

  it('phản hồi sai checksum -> ném lỗi (không tin kết quả)', async () => {
    respond({
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_Amount: '4900000',
      vnp_SecureHash: 'deadbeef',
    });
    await expect(provider.queryPayment(queryInput())).rejects.toThrow('checksum');
  });

  it('91 (không thấy) trước hạn + grace -> chưa kết luận; sau hạn + grace -> expired', async () => {
    respond(signedResponse({ vnp_ResponseCode: '91', vnp_Message: 'Not found' }));
    await expect(provider.queryPayment(queryInput())).resolves.toMatchObject({ status: null });
    respond(signedResponse({ vnp_ResponseCode: '91', vnp_Message: 'Not found' }));
    await expect(
      provider.queryPayment(queryInput({ attemptExpiresAt: new Date(Date.now() - 11 * 60_000) })),
    ).resolves.toMatchObject({
      status: 'expired',
    });
  });

  it('phản hồi không ký với mã lỗi -> ném lỗi, không đánh expired', async () => {
    respond({ vnp_ResponseCode: '91', vnp_Message: 'Not found' });
    await expect(
      provider.queryPayment(queryInput({ attemptExpiresAt: new Date(Date.now() - 11 * 60_000) })),
    ).rejects.toThrow('checksum');
  });

  it('refund toàn phần dùng loại 02 + ký chuỗi |; một phần dùng 03', async () => {
    const refundFields = QUERY_FIELDS.slice(0, 13);
    respond(
      signedResponse(
        { vnp_ResponseCode: '00', vnp_TransactionNo: '14000009', vnp_Command: 'refund' },
        refundFields,
      ),
    );
    const input = {
      tenantId: 'tenant-1',
      refundPublicId: 'rf_1',
      paymentIntentPublicId: 'pi_1',
      attemptId: 'attempt-1',
      attemptCreatedAt: new Date('2026-10-18T17:30:05Z'),
      providerOrderId: PAID_IPN.vnp_TxnRef,
      providerPaymentId: '14000001',
      providerData: { txnRef: PAID_IPN.vnp_TxnRef, createDate: '20261019003005' },
      amountMinor: 49000n,
      currency: 'VND',
      capturedAmountMinor: 49000n,
      isFullRefund: true,
      reason: null,
      paidAt: new Date(),
      providerAccount: ACCOUNT,
      context: { clientIp: '198.51.100.10' },
    };

    await expect(provider.createRefund(input)).resolves.toMatchObject({
      status: 'succeeded',
      providerRefundId: '14000009',
    });
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({
      vnp_TransactionType: '02',
      vnp_Amount: '4900000',
      vnp_TransactionDate: '20261019003005',
    });
    const expected = createHmac('sha512', SECRET)
      .update(
        [
          body.vnp_RequestId,
          '2.1.0',
          'refund',
          'TESTTMN1',
          '02',
          PAID_IPN.vnp_TxnRef,
          '4900000',
          '14000001',
          '20261019003005',
          'payment-gateway-service',
          body.vnp_CreateDate,
          '198.51.100.10',
          body.vnp_OrderInfo,
        ].join('|'),
      )
      .digest('hex');
    expect(body.vnp_SecureHash).toBe(expected);

    fetchSpy.mockRestore();
    respond(signedResponse({ vnp_ResponseCode: '00' }, refundFields));
    await provider.createRefund({ ...input, isFullRefund: false, amountMinor: 10000n });
    expect(JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      vnp_TransactionType: '03',
      vnp_Amount: '1000000',
    });
  });
});

describe('VnpayProvider.validateAccount', () => {
  const provider = new VnpayProvider(CONFIG);

  it('đòi TmnCode + hashSecret; config sai kiểu bị báo', () => {
    expect(
      provider.validateAccount({
        externalAccountRef: 'TESTTMN1',
        credentials: { hashSecret: SECRET },
        config: null,
      }),
    ).toEqual([]);
    expect(
      provider.validateAccount({
        externalAccountRef: null,
        credentials: {},
        config: { expireMinutes: 1, locale: 'fr' },
      }),
    ).toHaveLength(4);
  });
});
