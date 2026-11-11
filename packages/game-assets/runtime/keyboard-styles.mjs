export const COLORWAYS = {
  neon: {
    name: 'Neon trong suốt',
    alpha: null,
    mod: null,
    accent: null,
    legend: null,
    pudding: true,
  },
  retro: {
    name: 'Kem retro',
    alpha: '#efe6d6',
    mod: '#8e9099',
    accent: '#d9a441',
    space: '#d9a441',
    legend: '#2a2724',
    pudding: false,
  },
  graphite: {
    name: 'Than chì',
    alpha: '#2b2d33',
    mod: '#3b3f48',
    accent: '#9aa0a8',
    legend: '#e8eaf0',
    pudding: false,
  },
  arctic: {
    name: 'Băng xanh',
    alpha: '#f2f4f7',
    mod: '#c7d2e0',
    accent: '#2f7bff',
    legend: '#1f2733',
    pudding: false,
  },
  rose: {
    name: 'Hồng đen',
    alpha: '#2a2a2e',
    mod: '#2a2a2e',
    accent: '#e8b4b8',
    legend: '#f1dfe1',
    pudding: false,
  },
  forest: {
    name: 'Rừng vàng',
    alpha: '#dfe3d6',
    mod: '#4f6b5a',
    accent: '#f0b03c',
    legend: '#243028',
    pudding: false,
  },
};

export const LED_MODES = {
  rainbow: 'Cầu vồng theo phím',
  single: 'Một màu theo dải sáng',
  white: 'Trắng',
  off: 'Tắt',
};

const ACCENT_CODES = new Set([
  'Escape',
  'Enter',
  'NumpadEnter',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);
const ALPHA_CODES = new Set([
  'Backquote',
  'Minus',
  'Equal',
  'BracketLeft',
  'BracketRight',
  'Backslash',
  'Semicolon',
  'Quote',
  'Comma',
  'Period',
  'Slash',
  'NumpadDecimal',
]);

export function zoneOf(key) {
  if (ACCENT_CODES.has(key.code)) return 'accent';
  if (/^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(key.code) || ALPHA_CODES.has(key.code))
    return 'alpha';
  return 'mod';
}

export function keyboardOptions(recipe) {
  const chosen = recipe?.keyboard ?? {};
  return {
    colorway: COLORWAYS[chosen.colorway] ? chosen.colorway : 'neon',
    led: LED_MODES[chosen.led] ? chosen.led : 'rainbow',
  };
}
