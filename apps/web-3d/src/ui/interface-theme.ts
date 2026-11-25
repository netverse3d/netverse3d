import { readableAccent } from '@netverse/ui/accent';
import type { QualityLevel } from '../state/shop-slice.ts';

export interface InterfaceTheme {
  quality: QualityLevel;
  accent: string | null;
}

export interface ThemePalette {
  surfaces: readonly string[];
  onAccent: string | null;
}

export interface ThemeRoot {
  dataset: Record<string, string | undefined>;
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): string;
  };
}

const ACCENT_PROPERTY = '--ui-accent';
export const THEME_SURFACES = ['--ui-surface', '--ui-surface-raised', '--ui-surface-glass'];
export const THEME_ON_ACCENT = '--ui-on-action';

export function applyInterfaceTheme(
  root: ThemeRoot,
  theme: InterfaceTheme,
  palette: ThemePalette,
): () => void {
  root.dataset.uiQuality = theme.quality;
  const accent = theme.accent
    ? readableAccent(theme.accent, palette.surfaces, { onAccent: palette.onAccent ?? '' })
    : null;
  if (accent) root.style.setProperty(ACCENT_PROPERTY, accent);
  else root.style.removeProperty(ACCENT_PROPERTY);
  return () => {
    delete root.dataset.uiQuality;
    root.style.removeProperty(ACCENT_PROPERTY);
  };
}
