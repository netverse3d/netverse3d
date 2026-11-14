import { randomBytes } from 'crypto';
import { asRecord, providerRequestJson, stringField } from '../shared/provider-http.client';
import { VNPAY_VERSION } from './vnpay.constants';
import { formatVnpayDate } from './vnpay-date.util';
import { verifyVnpayPipeHash, vnpayPipeHash } from './vnpay-signature.util';

export class VnpayChecksumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VnpayChecksumError';
  }
}

export interface VnpayApiCredentials {
  tmnCode: string;
  secrets: readonly string[];
}

export interface VnpayQueryDrInput {
  txnRef: string;
  transactionDate: string;
  orderInfo: string;
  transactionNo?: string | null;
  ipAddr: string;
  now?: Date;
}

export interface VnpayRefundInput {
  txnRef: string;
  transactionDate: string;
  transactionType: '02' | '03';
  amountMinor: bigint;
  transactionNo?: string | null;
  orderInfo: string;
  createBy: string;
  ipAddr: string;
  now?: Date;
}

const QUERY_RESPONSE_FIELDS = [
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
] as const;

const REFUND_RESPONSE_FIELDS = [
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
] as const;

function firstSecret(secrets: readonly string[]): string {
  const secret = secrets[0];
  if (!secret) throw new Error('VNPAY account has no hash secret');
  return secret;
}

export class VnpayApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async queryDr(credentials: VnpayApiCredentials, input: VnpayQueryDrInput) {
    const requestId = newRequestId();
    const createDate = formatVnpayDate(input.now ?? new Date());
    const values = [
      requestId,
      VNPAY_VERSION,
      'querydr',
      credentials.tmnCode,
      input.txnRef,
      input.transactionDate,
      createDate,
      input.ipAddr,
      input.orderInfo,
    ];
    const body = {
      vnp_RequestId: requestId,
      vnp_Version: VNPAY_VERSION,
      vnp_Command: 'querydr',
      vnp_TmnCode: credentials.tmnCode,
      vnp_TxnRef: input.txnRef,
      vnp_OrderInfo: input.orderInfo,
      ...(input.transactionNo ? { vnp_TransactionNo: input.transactionNo } : {}),
      vnp_TransactionDate: input.transactionDate,
      vnp_CreateDate: createDate,
      vnp_IpAddr: input.ipAddr,
      vnp_SecureHash: vnpayPipeHash(firstSecret(credentials.secrets), values),
    };
    return this.post(credentials, body, QUERY_RESPONSE_FIELDS);
  }

  async refund(credentials: VnpayApiCredentials, input: VnpayRefundInput) {
    const requestId = newRequestId();
    const createDate = formatVnpayDate(input.now ?? new Date());
    const amount = (input.amountMinor * 100n).toString();
    const transactionNo = input.transactionNo ?? '';
    const values = [
      requestId,
      VNPAY_VERSION,
      'refund',
      credentials.tmnCode,
      input.transactionType,
      input.txnRef,
      amount,
      transactionNo,
      input.transactionDate,
      input.createBy,
      createDate,
      input.ipAddr,
      input.orderInfo,
    ];
    const body = {
      vnp_RequestId: requestId,
      vnp_Version: VNPAY_VERSION,
      vnp_Command: 'refund',
      vnp_TmnCode: credentials.tmnCode,
      vnp_TransactionType: input.transactionType,
      vnp_TxnRef: input.txnRef,
      vnp_Amount: amount,
      vnp_OrderInfo: input.orderInfo,
      vnp_TransactionNo: transactionNo,
      vnp_TransactionDate: input.transactionDate,
      vnp_CreateBy: input.createBy,
      vnp_CreateDate: createDate,
      vnp_IpAddr: input.ipAddr,
      vnp_SecureHash: vnpayPipeHash(firstSecret(credentials.secrets), values),
    };
    return this.post(credentials, body, REFUND_RESPONSE_FIELDS);
  }

  private async post(
    credentials: VnpayApiCredentials,
    body: Record<string, string>,
    responseFields: readonly string[],
  ) {
    const response = await providerRequestJson(
      this.apiUrl,
      { method: 'POST', body },
      this.timeoutMs,
    );
    const data = asRecord(response.body);
    const responseCode = stringField(data.vnp_ResponseCode);
    const values = responseFields.map((field) => stringField(data[field]));
    if (!verifyVnpayPipeHash(credentials.secrets, values, stringField(data.vnp_SecureHash))) {
      throw new VnpayChecksumError(
        `VNPAY response checksum mismatch (code ${responseCode || 'none'})`,
      );
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) result[key] = stringField(value);
    return result;
  }
}

function newRequestId() {
  return randomBytes(16).toString('hex');
}
