export const VIETQR_DEFAULT_PREFIX = 'QZ';
const REFERENCE_MAX = 25;
const MAX_CANDIDATES = 12;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function buildBankTransferQrReference(prefix: string, orderNumber: bigint): string {
  const body = orderNumber.toString(36).toUpperCase();
  const reference = `${prefix.toUpperCase()}${body}${checkCharacter(body)}`;
  if (!/^[A-Z0-9]+$/.test(reference) || reference.length > REFERENCE_MAX) {
    throw new Error('VietQR reference must be <= 25 uppercase ASCII letters/digits');
  }
  return reference;
}

export function hasValidCheckCharacter(token: string): boolean {
  if (token.length < 2) return false;
  const body = token.slice(0, -1);
  if (!/^[0-9A-Z]+$/.test(body)) return false;
  return checkCharacter(body) === token.slice(-1);
}

function checkCharacter(body: string): string {
  const base = ALPHABET.length;
  let sum = 0;
  let factor = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const product = factor * ALPHABET.indexOf(body.charAt(index));
    sum += Math.floor(product / base) + (product % base);
    factor = factor === 2 ? 1 : 2;
  }
  return ALPHABET.charAt((base - (sum % base)) % base);
}

export function normalizeTransferText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function extractBankTransferQrReferences(
  texts: ReadonlyArray<string | null | undefined>,
  prefix: string,
): string[] {
  const normalizedPrefix = prefix.toUpperCase();
  const pattern = new RegExp(`${normalizedPrefix} ?([0-9A-Z]+)`, 'g');
  const exact: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const match of normalizeTransferText(text).matchAll(pattern)) {
      const candidate = match[1];
      if (candidate && hasValidCheckCharacter(candidate))
        exact.push(`${normalizedPrefix}${candidate}`);
    }
  }
  return Array.from(new Set(exact))
    .filter((reference) => reference.length <= REFERENCE_MAX)
    .slice(0, MAX_CANDIDATES);
}
