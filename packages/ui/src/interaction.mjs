export function buttonInteraction(state, disabled) {
  const pending = state === 'pending';
  return { disabled: Boolean(disabled) || state !== 'idle', busy: pending, spinner: pending };
}

export function closesOnCancel(busy) {
  return !busy;
}
