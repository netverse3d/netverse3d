export function normalizeJsonValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }
  if (typeof value !== 'object' || value === null || value instanceof Date) {
    return value;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, normalizeJsonValue(child)]),
  );
}
