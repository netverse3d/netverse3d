import { createHmac } from 'crypto';
import {
  ProviderAccountContext,
  ProviderRuntimeConfig,
  ProviderWebhookRequest,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { ProviderTransportError } from '@app/modules/providers/shared/provider-http.client';
import {
  payosCreateSignatureData,
  payosDataString,
  payosSign,
} from '@app/modules/providers/payos/payos-signature.util';
import { PayosProvider, payosDescription } from '@app/modules/providers/payos/payos.provider';

const CHECKSUM = 'payos-checksum-key-test';
const CONFIG: ProviderRuntimeConfig = {
  httpTimeoutMs: 1000,
  expiryGraceMinutes: 10,
  serverIp: '198.51.100.10',
  vnpayPaymentUrl: 'https://vnpay.invalid',
  vnpayApiUrl: 'https://vnpay.invalid',
  payosApiBaseUrl: 'https://payos.test',
  payosOrderCodeOffset: 0,
};
const ACCOUNT: ProviderAccountContext = {
  id: 'pa-payos',
  tenant_id: 'tenant-1',
  externalAccountRef: 'client-123',
  credentials: { clientId: 'client-123', apiKey: 'api-key-xyz', checksumKey: CHECKSUM },
  config: null,
};

function signed(data: Record<string, unknown>) {
  return {
    code: '00',
    desc: 'success',
    data,
    signature: payosSign(CHECKSUM, payosDataString(data)),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function checkoutInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-1',
    paymentIntentId: 'intent-1',
    publicId: 'pi_1',
    attemptId: 'attempt-1',
    orderNumber: 1234n,
    createdAt: new Date('2026-10-18T10:00:00Z'),
    amountMinor: 49000n,
    currency: 'VND',
    title: 'Pro',
    returnUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_1',
    providerAccount: ACCOUNT,
    providerOrderRef: 'ref',
    context: { clientIp: '203.0.113.7' },
    ...overrides,
  };
}

const LINK = {
  bin: '970422',
  accountNumber: '113366668888',
  accountName: 'DEMO',
  amount: 49000,
  description: 'QZYA',
  orderCode: 1234,
  currency: 'VND',
  paymentLinkId: 'plink_1',
  status: 'PENDING',
  expiredAt: 1760782500,
  checkoutUrl: 'https://pay.payos.vn/web/plink_1',
  qrCode: '00020101021238570010A000000727',
};

function webhook(body: unknown): ProviderWebhookRequest {
  return {
    method: 'POST',
    query: {},
    headers: {},
    rawBody: JSON.stringify(body),
    body,
    routeAccountRef: 'client-123',
  };
}

describe('payOS — chữ ký', () => {
  it('chuỗi ký tạo link đúng thứ tự amount/cancelUrl/description/orderCode/returnUrl, HMAC-SHA256', () => {
    const data = payosCreateSignatureData({
      amount: 2000,
      cancelUrl: 'https://a.vn/c',
      description: 'QZ1',
      orderCode: 123,
      returnUrl: 'https://a.vn/r',
    });
    expect(data).toBe(
      'amount=2000&cancelUrl=https://a.vn/c&description=QZ1&orderCode=123&returnUrl=https://a.vn/r',
    );
    expect(payosSign('k', data)).toBe(createHmac('sha256', 'k').update(data).digest('hex'));
  });

  it('chuỗi dữ liệu: khoá sắp xếp, null -> rỗng, mảng JSON với khoá sắp xếp, undefined bị bỏ', () => {
    expect(payosDataString({ b: 2, a: null, c: [{ y: 1, x: 'z' }], d: undefined, e: 'null' })).toBe(
      'a=&b=2&c=[{"x":"z","y":1}]&e=',
    );
  });

  it('description = QZ + base36(orderNumber) viết hoa, tối đa 9 ký tự ASCII', () => {
    expect(payosDescription(1234n)).toBe('QZYA');
    expect(payosDescription(BigInt(Number.MAX_SAFE_INTEGER))).toHaveLength(9);
    expect(payosDescription(BigInt(Number.MAX_SAFE_INTEGER))).toMatch(/^QZ[0-9A-Z]{7}$/);
  });
});

describe('PayosProvider.createCheckout', () => {
  const provider = new PayosProvider(CONFIG);
  let fetchSpy: jest.SpyInstance;
  afterEach(() => fetchSpy?.mockRestore());

  it('gửi đúng header + chữ ký, xác minh chữ ký phản hồi, trả next_action QR để hiện ngay trên trang', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(json(signed(LINK)));

    const result = await provider.createCheckout(checkoutInput());

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://payos.test/v2/payment-requests');
    expect(init.headers).toMatchObject({ 'x-client-id': 'client-123', 'x-api-key': 'api-key-xyz' });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      orderCode: 1234,
      amount: 49000,
      description: 'QZYA',
      cancelUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_1',
      returnUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_1',
      expiredAt: Math.floor(new Date('2026-10-18T10:15:00Z').getTime() / 1000),
      items: [{ name: 'Payment', quantity: 1, price: 49000 }],
    });
    expect(body.signature).toBe(payosSign(CHECKSUM, payosCreateSignatureData(body)));
    expect(result).toMatchObject({
      providerPaymentId: 'plink_1',
      providerOrderId: '1234',
      checkoutUrl: LINK.checkoutUrl,
      qrPayload: LINK.qrCode,
      nextAction: {
        type: 'qr',
        payload: LINK.qrCode,
        bankBin: '970422',
        bankName: 'MB Bank',
        accountNumber: '113366668888',
        accountName: 'DEMO',
        amountMinor: 49000n,
        currency: 'VND',
        reference: 'QZYA',
      },
      status: 'requires_action',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('tên ngân hàng cấu hình trên tài khoản thắng bảng BIN; BIN là mã không biết -> ghi BIN', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(json(signed(LINK)));
    const named = await provider.createCheckout(
      checkoutInput({
        providerAccount: { ...ACCOUNT, config: { bankName: 'Ngân hàng Quân đội' } },
      }),
    );
    expect(named.nextAction).toMatchObject({ type: 'qr', bankName: 'Ngân hàng Quân đội' });

    fetchSpy.mockResolvedValue(json(signed({ ...LINK, bin: '999999' })));
    const unknown = await provider.createCheckout(checkoutInput());
    expect(unknown.nextAction).toMatchObject({ type: 'qr', bankName: 'Bank BIN 999999' });
  });

  it('phản hồi thiếu trường QR (vd link lấy lại) -> giữ next_action redirect để BE đổi cổng', async () => {
    const partial = { ...LINK, qrCode: undefined, accountNumber: undefined };
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(json(signed(partial)));
    const result = await provider.createCheckout(checkoutInput());
    expect(result.nextAction).toEqual({ type: 'redirect', url: LINK.checkoutUrl });
  });

  it('chữ ký phản hồi sai -> ném lỗi, không trả link', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ ...signed(LINK), signature: 'deadbeef' }));
    await expect(provider.createCheckout(checkoutInput())).rejects.toThrow('signature');
  });

  it('tạo bị timeout -> ném ProviderTransportError (504), chỉ gọi payOS một lần, không tra cứu và không huỷ link', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));

    await expect(provider.createCheckout(checkoutInput())).rejects.toBeInstanceOf(
      ProviderTransportError,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('payOS báo đơn đã tồn tại (231) -> 409 PAYOS_ORDER_CODE_TAKEN, KHÔNG huỷ link mang orderCode đó (có thể là đơn của người khác)', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ code: '231', desc: 'Đơn thanh toán đã tồn tại', data: null }));

    await expect(provider.createCheckout(checkoutInput())).rejects.toMatchObject({
      status: 409,
      details: { reason: 'PAYOS_ORDER_CODE_TAKEN', orderCode: 1234 },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/cancel'))).toBe(false);
  });

  it('PAYOS_ORDER_CODE_OFFSET cộng vào orderCode của link, tra cứu và huỷ; description vẫn theo số đơn gốc', async () => {
    const shifted = new PayosProvider({ ...CONFIG, payosOrderCodeOffset: 9_000_000_000 });
    const code = 9_000_001_234;
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json(signed({ ...LINK, orderCode: code })));

    const result = await shifted.createCheckout(checkoutInput());

    const body = JSON.parse(String((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ orderCode: code, description: 'QZYA' });
    expect(body.signature).toBe(payosSign(CHECKSUM, payosCreateSignatureData(body)));
    expect(result.providerOrderId).toBe(String(code));

    fetchSpy.mockResolvedValueOnce(
      json(
        signed({ id: 'plink_1', orderCode: code, amount: 49000, amountPaid: 0, status: 'PENDING' }),
      ),
    );
    await shifted.queryPayment({
      providerAccount: ACCOUNT,
      providerOrderId: null,
      orderNumber: 1234n,
    } as never);
    expect(fetchSpy.mock.calls[1][0]).toBe(`https://payos.test/v2/payment-requests/${code}`);
  });

  it('cancelUrl riêng của tenant được gửi đi và ký; thiếu thì rơi về returnUrl', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(json(signed(LINK)));

    await provider.createCheckout(
      checkoutInput({
        cancelUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_1&huy=1',
      }),
    );

    const body = JSON.parse(String((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.cancelUrl).toBe('https://shop.example.test/thanh-toan/ket-qua?checkout=cs_1&huy=1');
    expect(body.returnUrl).toBe('https://shop.example.test/thanh-toan/ket-qua?checkout=cs_1');
    expect(body.signature).toBe(payosSign(CHECKSUM, payosCreateSignatureData(body)));
  });

  it('thiếu returnUrl / không phải VND / account thiếu checksumKey -> 422', async () => {
    await expect(provider.createCheckout(checkoutInput({ returnUrl: null }))).rejects.toMatchObject(
      { status: 422 },
    );
    await expect(provider.createCheckout(checkoutInput({ currency: 'USD' }))).rejects.toMatchObject(
      { status: 422 },
    );
    await expect(
      provider.createCheckout(
        checkoutInput({
          providerAccount: { ...ACCOUNT, credentials: { clientId: 'client-123', apiKey: 'x' } },
        }),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('PayosProvider — webhook', () => {
  const provider = new PayosProvider(CONFIG);
  const data = {
    orderCode: 1234,
    amount: 49000,
    description: 'QZYA',
    accountNumber: '113366668888',
    reference: 'FT2610181234',
    transactionDateTime: '2026-10-18 17:20:00',
    currency: 'VND',
    paymentLinkId: 'plink_1',
    code: '00',
    desc: 'success',
    counterAccountBankId: '',
    counterAccountName: null,
    virtualAccountName: null,
  };
  const body = {
    code: '00',
    desc: 'success',
    success: true,
    data,
    signature: payosSign(CHECKSUM, payosDataString(data)),
  };

  it('inspect tra theo paymentLinkId + orderCode', () => {
    expect(provider.inspectWebhook(webhook(body))).toEqual({
      accountRef: null,
      merchantReference: '1234',
      providerPaymentId: 'plink_1',
      paymentIntentPublicId: null,
    });
  });

  it('chữ ký đúng -> verified; sửa số tiền -> invalid; account không có checksumKey -> no_secret', () => {
    expect(provider.verifyWebhook(webhook(body), ACCOUNT)).toMatchObject({ outcome: 'verified' });
    expect(
      provider.verifyWebhook(webhook({ ...body, data: { ...data, amount: 1 } }), ACCOUNT),
    ).toMatchObject({ outcome: 'invalid' });
    expect(
      provider.verifyWebhook(webhook({ ...body, signature: undefined }), ACCOUNT),
    ).toMatchObject({ outcome: 'invalid' });
    expect(provider.verifyWebhook(webhook(body), { ...ACCOUNT, credentials: {} })).toEqual({
      outcome: 'no_secret',
    });
  });

  it('code 00 + success -> succeeded với số tiền, mã sự kiện mang clientId', async () => {
    await expect(provider.normalizeWebhook(webhook(body), ACCOUNT)).resolves.toMatchObject({
      providerEventId: 'payos:client-123:1234:FT2610181234',
      status: 'succeeded',
      amountMinor: 49000n,
      currency: 'VND',
      providerOrderId: '1234',
      providerPaymentId: 'plink_1',
    });
  });

  it('không thành công -> không có status (bỏ qua)', async () => {
    await expect(
      provider.normalizeWebhook(webhook({ ...body, success: false, code: '01' }), ACCOUNT),
    ).resolves.toMatchObject({ status: null });
  });

  it('ACK: chữ ký sai -> 401; lỗi hệ thống -> 500; còn lại -> 200 {success:true}', () => {
    expect(
      provider.acknowledgeWebhook({ kind: 'rejected', statusCode: 401, reason: 'sig' }),
    ).toEqual({ httpStatus: 401, body: { success: false } });
    expect(
      provider.acknowledgeWebhook({ kind: 'rejected', statusCode: 500, reason: 'db' }).httpStatus,
    ).toBe(500);
    expect(provider.acknowledgeWebhook({ kind: 'ignored', reason: 'TARGET_NOT_FOUND' })).toEqual({
      httpStatus: 200,
      body: { success: true },
    });
  });
});

describe('PayosProvider — tra cứu / huỷ', () => {
  const provider = new PayosProvider(CONFIG);
  let fetchSpy: jest.SpyInstance;
  afterEach(() => fetchSpy?.mockRestore());

  const queryInput = {
    tenantId: 'tenant-1',
    publicId: 'pi_1',
    attemptId: 'attempt-1',
    orderNumber: 1234n,
    providerOrderId: '1234',
    providerPaymentId: 'plink_1',
    providerData: null,
    amountMinor: 49000n,
    currency: 'VND',
    attemptCreatedAt: new Date(),
    attemptExpiresAt: new Date(),
    providerAccount: ACCOUNT,
    context: { clientIp: null },
  };

  it.each([
    [
      { status: 'PAID', amountPaid: 49000 },
      { status: 'succeeded', amountMinor: 49000n },
    ],
    [{ status: 'CANCELLED', amountPaid: 0 }, { status: 'canceled' }],
    [{ status: 'EXPIRED', amountPaid: 0 }, { status: 'expired' }],
    [{ status: 'PENDING', amountPaid: 0 }, { status: null }],
    [{ status: 'UNDERPAID', amountPaid: 1000 }, { status: null }],
    [{ status: 'PROCESSING', amountPaid: 0 }, { status: null }],
  ])('GET %p -> %p', async (info, expected) => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json(signed({ id: 'plink_1', orderCode: 1234, amount: 49000, ...info })));
    await expect(provider.queryPayment(queryInput)).resolves.toMatchObject(expected);
    expect(fetchSpy.mock.calls[0][0]).toBe('https://payos.test/v2/payment-requests/1234');
  });

  it('huỷ link: POST /v2/payment-requests/<orderCode>/cancel', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ code: '00', desc: 'ok', data: {} }));
    await provider.cancelCheckout({
      tenantId: 'tenant-1',
      attemptId: 'attempt-1',
      orderNumber: 1234n,
      providerOrderId: '1234',
      providerPaymentId: 'plink_1',
      providerData: null,
      providerAccount: ACCOUNT,
      reason: 'x',
    });
    expect(fetchSpy.mock.calls[0][0]).toBe('https://payos.test/v2/payment-requests/1234/cancel');
  });

  it('validateAccount: clientId phải trùng externalAccountRef', () => {
    expect(
      provider.validateAccount({
        externalAccountRef: 'client-123',
        credentials: ACCOUNT.credentials,
        config: null,
      }),
    ).toEqual([]);
    expect(
      provider.validateAccount({
        externalAccountRef: 'other',
        credentials: ACCOUNT.credentials,
        config: null,
      }),
    ).toHaveLength(1);
  });
});
