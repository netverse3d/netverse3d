import { SOLID_ACTIONS, TOKEN_GROUPS } from '../src/catalog.mjs';

export const CONTRAST_RULES = [
  {
    criterion: 'K1',
    foregrounds: TOKEN_GROUPS.text,
    backgrounds: TOKEN_GROUPS.surfaces,
    minimum: 4.5,
  },
  { criterion: 'K1', foregrounds: ['--ui-on-action'], backgrounds: SOLID_ACTIONS, minimum: 4.5 },
  {
    criterion: 'K2',
    foregrounds: TOKEN_GROUPS.indicators,
    backgrounds: TOKEN_GROUPS.surfaces,
    minimum: 3,
  },
];

export function librarySections() {
  return [
    { id: 'palette', kind: 'swatches', tokens: TOKEN_GROUPS.palette },
    { id: 'surfaces', kind: 'swatches', tokens: TOKEN_GROUPS.surfaces },
    { id: 'text', kind: 'swatches', tokens: TOKEN_GROUPS.text },
    { id: 'indicators', kind: 'swatches', tokens: TOKEN_GROUPS.indicators },
    { id: 'actions', kind: 'swatches', tokens: TOKEN_GROUPS.actions },
    { id: 'overlays', kind: 'values', tokens: TOKEN_GROUPS.overlays },
    { id: 'contrast', kind: 'contrast', tokens: [] },
    { id: 'typography', kind: 'typography', tokens: TOKEN_GROUPS.typography },
    { id: 'spacing', kind: 'spacing', tokens: TOKEN_GROUPS.spacing },
    { id: 'radius', kind: 'radius', tokens: TOKEN_GROUPS.radius },
    { id: 'layers', kind: 'layers', tokens: TOKEN_GROUPS.layers },
    { id: 'motion', kind: 'motion', tokens: TOKEN_GROUPS.motion },
  ];
}
