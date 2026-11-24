const BLACK = { rgb: [0, 0, 0], alpha: 1 };
const WHITE = { rgb: [255, 255, 255], alpha: 1 };
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722];

export function parseColor(hex) {
  const digits = /^#([\da-f]{3,8})$/i.exec(hex.trim())?.[1];
  if (!digits || ![3, 6, 8].includes(digits.length)) throw new Error(`Unsupported color: ${hex}`);
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;
  const bytes = full.match(/../g).map((pair) => Number.parseInt(pair, 16));
  return { rgb: bytes.slice(0, 3), alpha: (bytes[3] ?? 255) / 255 };
}

function composite(top, bottom) {
  return {
    rgb: top.rgb.map((channel, index) => channel * top.alpha + bottom.rgb[index] * (1 - top.alpha)),
    alpha: 1,
  };
}

function luminance({ rgb }) {
  return rgb.reduce((sum, channel, index) => {
    const value = channel / 255;
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * LUMINANCE_WEIGHTS[index];
  }, 0);
}

function ratio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function contrastRatio(foreground, background) {
  const front = parseColor(foreground);
  const back = parseColor(background);
  return Math.min(
    ...[BLACK, WHITE].map((behind) => {
      const ground = composite(back, behind);
      return ratio(composite(front, ground), ground);
    }),
  );
}

export function mixColors(from, to, amount) {
  const start = parseColor(from).rgb;
  const end = parseColor(to).rgb;
  return `#${start
    .map((channel, index) =>
      Math.round(channel + (end[index] - channel) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
