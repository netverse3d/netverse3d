import { readableAccent } from '@netverse/ui/accent';
import type { QualityLevel } from '../state/shop-slice.ts';

export interface InterfaceTheme {
  quality: QualityLevel;
  accent: string | null;
}

export interface ThemeRoot {
  dataset: Record<string, string | undefined>;
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): string;
  };
}

const ACCENT_PROPERTY = '--ui-accent';
export const THEME_SURFACES = ['--ui-surface', '--ui-surface-raised', '--ui-panel'];

export function applyInterfaceTheme(
  root: ThemeRoot,
  theme: InterfaceTheme,
  surfaces: readonly string[],
): () => void {
  root.dataset.uiQuality = theme.quality;
  const accent = theme.accent ? readableAccent(theme.accent, surfaces) : null;
  if (accent) root.style.setProperty(ACCENT_PROPERTY, accent);
  else root.style.removeProperty(ACCENT_PROPERTY);
  return () => {
    delete root.dataset.uiQuality;
    root.style.removeProperty(ACCENT_PROPERTY);
  };
}
