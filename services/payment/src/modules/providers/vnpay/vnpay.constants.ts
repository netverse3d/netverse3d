export const VNPAY_PROVIDER_CODE = 'vnpay';
export const VNPAY_VERSION = '2.1.0';
export const VNPAY_CURRENCY = 'VND';
export const VNPAY_DEFAULT_EXPIRE_MINUTES = 15;
export const VNPAY_DEFAULT_LOCALE = 'vn';
export const VNPAY_DEFAULT_ORDER_TYPE = 'other';
export const VNPAY_SUCCESS = '00';
export const VNPAY_CUSTOMER_CANCELED = '24';
export const VNPAY_QUERY_NOT_FOUND = '91';
export const VNPAY_TXN_PENDING = '01';
export const VNPAY_TXN_FAILED = '02';

export const VNPAY_FAILURE_MESSAGES: Readonly<Record<string, string>> = {
  '09': 'Authentication failed',
  '10': 'Authentication failed',
  '11': 'The payment window has expired',
  '12': 'The card or account is locked',
  '13': 'Authentication failed',
  '24': 'The payer cancelled the transaction',
  '51': 'The account has insufficient funds',
  '75': 'The bank is under maintenance',
  '79': 'Authentication failed',
};

export const VNPAY_DEFAULT_FAILURE_MESSAGE = 'The transaction was declined';

export const VNPAY_IPN_ACK = {
  success: { RspCode: '00', Message: 'Confirm Success' },
  orderNotFound: { RspCode: '01', Message: 'Order not found' },
  alreadyConfirmed: { RspCode: '02', Message: 'Order already confirmed' },
  invalidAmount: { RspCode: '04', Message: 'Invalid amount' },
  invalidSignature: { RspCode: '97', Message: 'Invalid signature' },
  unknownError: { RspCode: '99', Message: 'Unknown error' },
} as const;
