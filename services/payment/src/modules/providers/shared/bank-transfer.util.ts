const PAYMENT_ID_MAX = 120;

export function bankTransferPaymentId(bankReference: string): string {
  return `bank:${bankReference.replace(/\s+/g, '').toUpperCase()}`.slice(0, PAYMENT_ID_MAX);
}
