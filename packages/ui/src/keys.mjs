const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const WIDGET_ROLES = [
  'combobox',
  'listbox',
  'option',
  'menu',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'radio',
  'radiogroup',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'tablist',
  'textbox',
];
const WIDGET_SELECTOR = WIDGET_ROLES.map((role) => `[role="${role}"]`).join(', ');

export function isWidgetKey(event) {
  const target = event.target;
  if (typeof target?.tagName === 'string' && TYPING_TAGS.has(target.tagName)) return true;
  return typeof target?.closest === 'function' && Boolean(target.closest(WIDGET_SELECTOR));
}

export function isClaimedKey(event) {
  return event.defaultPrevented || isWidgetKey(event);
}
