const names = (list) => list.split(' ').map((name) => `--ui-${name}`);

export const TOKEN_GROUPS = {
  palette: names(
    'core-night core-plum core-raised core-glass core-white core-silver core-line core-lavender core-sky core-mint core-amber core-rose core-peach core-scrim core-shadow core-tint',
  ),
  surfaces: names('canvas surface surface-raised surface-glass panel'),
  text: names('text text-muted'),
  indicators: names('border focus success warning error info accent highlight'),
  actions: names('action-primary action-neutral action-danger on-action'),
  overlays: names('scrim shadow tint panel-filter blur-panel'),
  typography: names(
    'font-family text-xs text-sm text-base text-lg text-xl text-2xl weight-normal weight-medium weight-bold line-tight line-normal',
  ),
  spacing: names('space-1 space-2 space-3 space-4 space-6 space-8'),
  radius: names('radius-1 radius-2 radius-3 radius-pill'),
  layers: names('layer-canvas layer-world layer-hud layer-toast layer-dialog layer-recovery'),
  motion: names('motion-instant motion-fast motion-base motion-panel motion-scene'),
};

export const SOLID_ACTIONS = names('action-primary action-danger accent');
export const TIMED_MOTION = names('motion-fast motion-base motion-panel motion-scene');

export function catalogTokens() {
  return [...new Set(Object.values(TOKEN_GROUPS).flat())];
}
