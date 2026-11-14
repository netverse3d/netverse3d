const VIETQR_GUID = 'A000000727';
const VIETQR_SERVICE_TO_ACCOUNT = 'QRIBFTTA';
const CURRENCY_VND = '704';
const COUNTRY_VN = 'VN';

export function tlv(id: string, value: string): string {
  if (!/^\d{2}$/.test(id)) throw new Error(`EMVCo id must be 2 digits: ${id}`);
  if (value.length === 0 || value.length > 99)
    throw new Error(`EMVCo field ${id} length must be 1-99`);
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

export function crc16CcittFalse(input: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface BankTransferQrPayloadInput {
  bankBin: string;
  accountNumber: string;
  amount: bigint;
  content: string;
}

export function buildBankTransferQrPayload(input: BankTransferQrPayloadInput): string {
  if (!/^\d{6}$/.test(input.bankBin)) throw new Error('bankBin must be 6 digits');
  if (input.amount <= 0n || input.amount.toString().length > 13)
    throw new Error('VietQR amount must be 1-13 digits');
  if (!/^[A-Za-z0-9 ]{1,25}$/.test(input.content))
    throw new Error('VietQR content must be <= 25 ASCII letters, digits or spaces');
  const beneficiary = tlv('00', input.bankBin) + tlv('01', input.accountNumber);
  const merchantAccount =
    tlv('00', VIETQR_GUID) + tlv('01', beneficiary) + tlv('02', VIETQR_SERVICE_TO_ACCOUNT);
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchantAccount) +
    tlv('53', CURRENCY_VND) +
    tlv('54', input.amount.toString()) +
    tlv('58', COUNTRY_VN) +
    tlv('62', tlv('08', input.content)) +
    '6304';
  return body + crc16CcittFalse(body);
}

export function parseTlv(payload: string): Record<string, string> {
  const result: Record<string, string> = {};
  let index = 0;
  while (index < payload.length) {
    const id = payload.slice(index, index + 2);
    const length = Number(payload.slice(index + 2, index + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(length)) throw new Error('Malformed EMVCo TLV');
    result[id] = payload.slice(index + 4, index + 4 + length);
    index += 4 + length;
  }
  return result;
}

export function hasValidCrc(payload: string): boolean {
  if (payload.length < 8 || payload.slice(-8, -4) !== '6304') return false;
  return crc16CcittFalse(payload.slice(0, -4)) === payload.slice(-4);
}
