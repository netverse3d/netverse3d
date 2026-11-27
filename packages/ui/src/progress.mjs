export const PROGRESS_MAX = 100;

export function progressValue(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= 0 && value <= PROGRESS_MAX ? value : null;
}
