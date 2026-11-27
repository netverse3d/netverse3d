const STEP_PRECISION = 1e9;

export function chooseItem(items, currentId, nextId) {
  const next = items.find((item) => item.id === nextId);
  return next && !next.locked ? next.id : currentId;
}

export function stepNumber(value, direction, { min, max, step }) {
  if (!Number.isFinite(value)) return min;
  const steps = Math.round((value - min) / step) + direction;
  const snapped = Math.round((min + steps * step) * STEP_PRECISION) / STEP_PRECISION;
  return Math.min(max, Math.max(min, snapped));
}
