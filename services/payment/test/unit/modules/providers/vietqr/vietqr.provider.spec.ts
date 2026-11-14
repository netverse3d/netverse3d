import { createHmac } from 'crypto';
import {
  ProviderAccountContext,
  ProviderWebhookRequest,
} from '@app/modules/providers/contracts/payment-provider.contract';
import {
  buildBankTransferQrPayload,
  crc16CcittFalse,
  hasValidCrc,
  parseTlv,
} from '@app/modules/providers/vietqr/emvco-qr.util';
import { verifySepayRequest } from '@app/modules/providers/vietqr/feeds/sepay.feed';
import {
  buildBankTransferQrReference,
  extractBankTransferQrReferences,
} from '@app/modules/providers/vietqr/vietqr-reference.util';
import { BankTransferQrProvider } from '@app/modules/providers/vietqr/vietqr.provider';

const VECTOR_3ACF =
  '00020101021238560010A0000007270126000697041501121133666688880208QRIBFTTA53037045405790005802VN62220818Ung Ho Quy Vac Xin63043ACF';
const VECTOR_2FCE =
  '00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045405500005802VN62120808QZH1234563042FCE';

const ACCOUNT: ProviderAccountContext = {
  id: 'pa-vqr',
  tenant_id: 'tenant-1',
  externalAccountRef: '113366668888',
  credentials: { sepayApiKey: 'sepay-key-123', sepayHmacSecret: 'sepay-hmac-secret' },
  config: {
    bankBin: '970415',
    bankName: 'VietinBank',
    accountNumber: '113366668888',
    accountName: 'CONG TY DEMO',
    referencePrefix: 'QZ',
    ttlMinutes: 30,
  },
};

function sepayRequest(
  body: Record<string, unknown>,
  headers: ProviderWebhookRequest['headers'],
): ProviderWebhookRequest {
  return {
    method: 'POST',
    query: {},
    headers,
    rawBody: JSON.stringify(body),
    body,
    routeAccountRef: '113366668888',
  };
}

describe('EMVCo VietQR', () => {
  it.each([VECTOR_3ACF, VECTOR_2FCE])('CRC16/CCITT-FALSE đúng vector chuẩn %#', (vector) => {
    expect(crc16CcittFalse(vector.slice(0, -4))).toBe(vector.slice(-4));
    expect(hasValidCrc(vector)).toBe(true);
  });

  it('dựng lại đúng từng byte vector 3ACF (Vietinbank, 79.000 VND)', () => {
    expect(
      buildBankTransferQrPayload({
        bankBin: '970415',
        accountNumber: '113366668888',
        amount: 79000n,
        content: 'Ung Ho Quy Vac Xin',
      }),
    ).toBe(VECTOR_3ACF);
  });

  it('dựng lại đúng từng byte vector 2FCE (BIN 970436, nội dung QZH12345)', () => {
    expect(
      buildBankTransferQrPayload({
        bankBin: '970436',
        accountNumber: '0011001234567',
        amount: 50000n,
        content: 'QZH12345',
      }),
    ).toBe(VECTOR_2FCE);
  });

  it('nội dung > 25 ký tự hoặc có dấu -> từ chối', () => {
    expect(() =>
      buildBankTransferQrPayload({
        bankBin: '970415',
        accountNumber: '1',
        amount: 1n,
        content: 'A'.repeat(26),
      }),
    ).toThrow();
    expect(() =>
      buildBankTransferQrPayload({
        bankBin: '970415',
        accountNumber: '1',
        amount: 1n,
        content: 'Ủng hộ',
      }),
    ).toThrow();
  });

  it('parseTlv đọc lại các trường', () => {
    const fields = parseTlv(VECTOR_2FCE);
    expect(fields).toMatchObject({
      '00': '01',
      '01': '12',
      '53': '704',
      '54': '50000',
      '58': 'VN',
      '62': '0808QZH12345',
      '63': '2FCE',
    });
  });
});

describe('Mã tham chiếu VietQR', () => {
  it('QZ + base36(order_number) viết hoa, <= 25 ASCII', () => {
    expect(buildBankTransferQrReference('QZ', 1234n)).toBe('QZYAI');
    expect(buildBankTransferQrReference('QZ', BigInt(Number.MAX_SAFE_INTEGER))).toMatch(
      /^QZ[0-9A-Z]{1,23}$/,
    );
  });

  it('trích mã từ nội dung ngân hàng chèn thêm chữ, có dấu, dấu chấm, dấu cách', () => {
    expect(
      extractBankTransferQrReferences(['MBVCB.11597744196.QZYAI.CT tu 0123 NGUYEN VAN A'], 'QZ')[0],
    ).toBe('QZYAI');
    expect(extractBankTransferQrReferences(['chuyển tiền qzyai'], 'QZ')[0]).toBe('QZYAI');
    expect(extractBankTransferQrReferences(['IBFT QZ YAI'], 'QZ')[0]).toBe('QZYAI');
    expect(extractBankTransferQrReferences(['QZYAICHUYENTIEN'], 'QZ')).toEqual([]);
    expect(extractBankTransferQrReferences(['QZYBI', 'QZAYI', 'QZYA'], 'QZ')).toEqual([]);
    expect(extractBankTransferQrReferences([null, 'khong co ma'], 'QZ')).toEqual([]);
  });
});

describe('SePay xác thực', () => {
  const body = { id: 92704, transferType: 'in' };
  const raw = JSON.stringify(body);

  it('Apikey đúng -> verified; sai -> invalid', () => {
    const credentials = { apiKey: 'sepay-key-123', hmacSecret: null };
    expect(
      verifySepayRequest(
        sepayRequest(body, { authorization: 'Apikey sepay-key-123' }),
        credentials,
      ),
    ).toMatchObject({ outcome: 'verified' });
    expect(
      verifySepayRequest(sepayRequest(body, { authorization: 'Apikey wrong' }), credentials),
    ).toMatchObject({ outcome: 'invalid' });
    expect(verifySepayRequest(sepayRequest(body, {}), credentials)).toMatchObject({
      outcome: 'invalid',
    });
  });

  it('HMAC trên `${timestamp}.${rawBody}` trong +-300 s -> verified; lệch thời gian -> invalid', () => {
    const credentials = { apiKey: null, hmacSecret: 'sepay-hmac-secret' };
    const now = new Date('2026-10-18T10:00:00Z');
    const ts = String(Math.floor(now.getTime() / 1000));
    const sig = createHmac('sha256', 'sepay-hmac-secret').update(`${ts}.${raw}`).digest('hex');
    const headers = { 'x-sepay-signature': `sha256=${sig}`, 'x-sepay-timestamp': ts };

    expect(verifySepayRequest(sepayRequest(body, headers), credentials, now)).toMatchObject({
      outcome: 'verified',
    });
    expect(
      verifySepayRequest(
        sepayRequest(body, headers),
        credentials,
        new Date(now.getTime() + 301_000),
      ),
    ).toMatchObject({ outcome: 'invalid' });
    expect(
      verifySepayRequest(sepayRequest({ ...body, id: 1 }, headers), credentials, now),
    ).toMatchObject({ outcome: 'invalid' });
  });

  it('account không có khoá nào -> no_secret', () => {
    expect(verifySepayRequest(sepayRequest(body, {}), { apiKey: null, hmacSecret: null })).toEqual({
      outcome: 'no_secret',
    });
  });
});

describe('BankTransferQrProvider', () => {
  const provider = new BankTransferQrProvider();

  it('createCheckout: QR động 01=12, số tiền nguyên VND, next_action qr đủ trường, hết hạn theo ttl', async () => {
    const createdAt = new Date('2026-10-18T10:00:00Z');
    const result = await provider.createCheckout({
      tenantId: 'tenant-1',
      paymentIntentId: 'intent-1',
      publicId: 'pi_1',
      attemptId: 'attempt-1',
      orderNumber: 1234n,
      createdAt,
      amountMinor: 49000n,
      currency: 'VND',
      title: 'Pro',
      providerAccount: ACCOUNT,
      providerOrderRef: 'ref',
      context: { clientIp: null },
    });

    const fields = parseTlv(result.qrPayload!);
    expect(fields['01']).toBe('12');
    expect(fields['54']).toBe('49000');
    expect(parseTlv(fields['62']!)['08']).toBe('QZYAI');
    expect(hasValidCrc(result.qrPayload!)).toBe(true);
    expect(result).toMatchObject({
      providerOrderId: 'QZYAI',
      status: 'requires_action',
      expiresAt: new Date('2026-10-18T10:30:00Z'),
      nextAction: {
        type: 'qr',
        payload: result.qrPayload,
        bankBin: '970415',
        bankName: 'VietinBank',
        accountNumber: '113366668888',
        accountName: 'CONG TY DEMO',
        amountMinor: 49000n,
        currency: 'VND',
        reference: 'QZYAI',
        expiresAt: new Date('2026-10-18T10:30:00Z'),
      },
    });
  });

  it('webhook SePay: inspect trích mã theo prefix của account; transferType out -> không status', async () => {
    const inBody = {
      id: 1,
      accountNumber: '113366668888',
      code: null,
      content: 'MBVCB.1.QZYAI.CT',
      transferType: 'in',
      transferAmount: 49000,
      referenceCode: 'FT1',
    };
    expect(provider.inspectWebhook(sepayRequest(inBody, {}), ACCOUNT)).toMatchObject({
      accountRef: '113366668888',
      merchantReferenceCandidates: expect.arrayContaining(['QZYAI']),
      providerPaymentId: 'bank:FT1',
    });
    await expect(
      provider.normalizeWebhook(sepayRequest(inBody, {}), ACCOUNT),
    ).resolves.toMatchObject({
      providerEventId: 'sepay:113366668888:1',
      status: 'succeeded',
      amountMinor: 49000n,
      currency: 'VND',
    });
    await expect(
      provider.normalizeWebhook(sepayRequest({ ...inBody, transferType: 'out' }, {}), ACCOUNT),
    ).resolves.toMatchObject({ status: null });
    await expect(
      provider.normalizeWebhook(sepayRequest({ ...inBody, accountNumber: '999' }, {}), ACCOUNT),
    ).resolves.toMatchObject({ status: null });
  });

  it('ACK SePay: 200 {success:true}; xác thực sai 401', () => {
    expect(provider.acknowledgeWebhook({ kind: 'ignored', reason: 'TARGET_NOT_FOUND' })).toEqual({
      httpStatus: 200,
      body: { success: true },
    });
    expect(provider.acknowledgeWebhook({ kind: 'rejected', statusCode: 401, reason: 'x' })).toEqual(
      { httpStatus: 401, body: { success: false } },
    );
  });

  it('validateAccount: số TK trùng externalAccountRef, cần ít nhất một khoá SePay', () => {
    expect(
      provider.validateAccount({
        externalAccountRef: '113366668888',
        credentials: ACCOUNT.credentials,
        config: ACCOUNT.config,
      }),
    ).toEqual([]);
    expect(
      provider.validateAccount({
        externalAccountRef: 'other',
        credentials: {},
        config: ACCOUNT.config,
      }),
    ).toHaveLength(2);
  });
});
