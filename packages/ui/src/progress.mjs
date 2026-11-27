export const PROGRESS_MAX = 100;

export function progressValue(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value > PROGRESS_MAX)
    throw new RangeError(`progress must be between 0 and ${PROGRESS_MAX}, got ${value}`);
  return value;
}
