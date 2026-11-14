export function normalizeForJson(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJson(item));
  }
  if (value === null || value === undefined || value instanceof Date) {
    return value;
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeForJson(item),
      ]),
    );
  }
  return value;
}
