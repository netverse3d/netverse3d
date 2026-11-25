import { useEffect, useLayoutEffect, useState } from 'react';
import { readableAccent } from '../src/accent.mjs';
import { Foundations, tokenValue } from './foundations.tsx';
import { ComponentShowcase } from './showcase.tsx';
import text from './text.json';

type Recipe = { id: string; name?: string; palette?: { accent?: string[] } };
type Settings = { accent: string; quality: string; transparency: boolean; motion: boolean };

const ACCENT_SURFACES = ['--ui-surface', '--ui-surface-raised', '--ui-surface-glass'];
const QUALITIES = ['low', 'medium', 'high'] as const;
const LINKS = {
  criteria: '../wiki/product/ui-criteria.html',
  system: '../wiki/engineering/design-system.html',
  assets: '../game-assets/library/',
} as const;

async function loadRecipes(): Promise<Recipe[]> {
  const base = new URL('../game-assets/recipes/', document.baseURI);
  try {
    const ids: string[] = await (await fetch(new URL('index.json', base))).json();
    const recipes = await Promise.all(
      ids.map(async (id) => ({
        id,
        ...((await (await fetch(new URL(`${id}.json`, base))).json()) as Omit<Recipe, 'id'>),
      })),
    );
    return recipes.filter((recipe) => recipe.palette?.accent?.[0]);
  } catch {
    return [];
  }
}

function applySettings(settings: Settings): string {
  const root = document.documentElement;
  root.dataset.uiQuality = settings.quality;
  if (settings.transparency) root.dataset.uiTransparency = 'reduced';
  else delete root.dataset.uiTransparency;
  if (settings.motion) root.dataset.uiMotion = 'reduced';
  else delete root.dataset.uiMotion;
  root.style.removeProperty('--ui-accent');
  if (!settings.accent) return '';
  const surfaces = ACCENT_SURFACES.map(tokenValue).filter((value) =>
    /^#[\da-f]{3,8}$/i.test(value),
  );
  const readable = readableAccent(settings.accent, surfaces, {
    onAccent: tokenValue('--ui-on-action'),
  });
  if (!readable) return '';
  root.style.setProperty('--ui-accent', readable);
  return readable === settings.accent
    ? ''
    : text.controls.accentAdjusted.replace('{from}', settings.accent).replace('{to}', readable);
}

function Controls({
  settings,
  recipes,
  onChange,
}: {
  settings: Settings;
  recipes: Recipe[];
  onChange: (settings: Settings) => void;
}) {
  return (
    <form className="controls" onSubmit={(event) => event.preventDefault()}>
      <label>
        {text.controls.accent}
        <select
          name="accent"
          value={settings.accent}
          onChange={(event) => onChange({ ...settings, accent: event.target.value })}
        >
          <option value="">{text.controls.accentDefault}</option>
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.palette?.accent?.[0]}>
              {recipe.name ?? recipe.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        {text.controls.quality}
        <select
          name="quality"
          value={settings.quality}
          onChange={(event) => onChange({ ...settings, quality: event.target.value })}
        >
          {QUALITIES.map((level) => (
            <option key={level} value={level}>
              {text.controls[`quality-${level}`]}
            </option>
          ))}
        </select>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          name="transparency"
          checked={settings.transparency}
          onChange={(event) => onChange({ ...settings, transparency: event.target.checked })}
        />
        {text.controls.transparency}
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          name="motion"
          checked={settings.motion}
          onChange={(event) => onChange({ ...settings, motion: event.target.checked })}
        />
        {text.controls.motion}
      </label>
    </form>
  );
}

export function Library() {
  const [settings, setSettings] = useState<Settings>({
    accent: '',
    quality: 'medium',
    transparency: false,
    motion: false,
  });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [applied, setApplied] = useState({ note: '', version: 0 });

  useEffect(() => {
    document.title = text.title;
    loadRecipes().then(setRecipes);
  }, []);

  useLayoutEffect(() => {
    const note = applySettings(settings);
    setApplied((previous) => ({ note, version: previous.version + 1 }));
  }, [settings]);

  return (
    <>
      <header className="masthead">
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
        <nav>
          {Object.entries(LINKS).map(([key, href]) => (
            <a key={key} href={href}>
              {text.links[key as keyof typeof LINKS]}
            </a>
          ))}
        </nav>
      </header>
      <Controls settings={settings} recipes={recipes} onChange={setSettings} />
      <p className="note" role="status">
        {applied.note}
      </p>
      <main id="sections" data-version={applied.version}>
        <ComponentShowcase text={text.components} />
        <Foundations text={text} />
      </main>
    </>
  );
}
