import { contrastRatio, mixColors, parseColor } from './contrast.mjs';

const MINIMUM_ACCENT_CONTRAST = 3;
const MINIMUM_TEXT_ON_ACCENT = 4.5;
const LIGHTEN_STEP = 0.05;

function isColor(value) {
  try {
    parseColor(value);
    return true;
  } catch {
    return false;
  }
}

export function readableAccent(
  accent,
  backgrounds,
  { minimum = MINIMUM_ACCENT_CONTRAST, onAccent = '', onMinimum = MINIMUM_TEXT_ON_ACCENT } = {},
) {
  if (typeof accent !== 'string' || !isColor(accent)) return null;
  const readable = (color) =>
    backgrounds.every((background) => contrastRatio(color, background) >= minimum) &&
    (!onAccent || contrastRatio(onAccent, color) >= onMinimum);
  for (let step = 0; step * LIGHTEN_STEP <= 1; step += 1) {
    const candidate = step === 0 ? accent : mixColors(accent, '#ffffff', step * LIGHTEN_STEP);
    if (readable(candidate)) return candidate;
  }
  return '#ffffff';
}
