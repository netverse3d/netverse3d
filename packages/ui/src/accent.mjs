import { contrastRatio, mixColors, parseColor } from './contrast.mjs';

const MINIMUM_ACCENT_CONTRAST = 3;
const LIGHTEN_STEP = 0.05;

function isColor(value) {
  try {
    parseColor(value);
    return true;
  } catch {
    return false;
  }
}

export function readableAccent(accent, backgrounds, minimum = MINIMUM_ACCENT_CONTRAST) {
  if (typeof accent !== 'string' || !isColor(accent)) return null;
  const readable = (color) =>
    backgrounds.every((background) => contrastRatio(color, background) >= minimum);
  for (let amount = 0; amount <= 1; amount += LIGHTEN_STEP) {
    const candidate = amount === 0 ? accent : mixColors(accent, '#ffffff', amount);
    if (readable(candidate)) return candidate;
  }
  return '#ffffff';
}
