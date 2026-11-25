import { readableAccent } from '../src/accent.mjs';
import { contrastRatio } from '../src/contrast.mjs';
import { componentShowcase } from './components.mjs';
import { element } from './dom.mjs';
import { CONTRAST_RULES, librarySections } from './sections.mjs';

const root = document.documentElement;
const ACCENT_SURFACES = ['--ui-surface', '--ui-surface-raised', '--ui-surface-glass'];
const QUALITIES = ['low', 'medium', 'high'];
const RECIPES_URL = new URL('../../game-assets/recipes/', import.meta.url);
const LINKS = {
  criteria: '../wiki/product/ui-criteria.html',
  system: '../wiki/engineering/design-system.html',
  assets: '../game-assets/library/',
};

function tokenValue(token) {
  return getComputedStyle(root).getPropertyValue(token).trim();
}

async function loadRecipes() {
  try {
    const ids = await (await fetch(new URL('index.json', RECIPES_URL))).json();
    const recipes = await Promise.all(
      ids.map(async (id) => ({
        id,
        ...(await (await fetch(new URL(`${id}.json`, RECIPES_URL))).json()),
      })),
    );
    return recipes.filter((recipe) => recipe.palette?.accent?.[0]);
  } catch {
    return [];
  }
}

function swatch(token) {
  return element('figure', { class: 'swatch' }, [
    element('span', { class: 'chip', style: { background: `var(${token})` } }),
    element('figcaption', {}, [
      element('code', { text: token }),
      element('span', { class: 'value', dataset: { token } }),
    ]),
  ]);
}

function valueRow(token) {
  return element('p', { class: 'value-row' }, [
    element('code', { text: token }),
    element('span', { class: 'value', dataset: { token } }),
  ]);
}

function contrastTable(text) {
  const head = element('tr', {}, [
    ...['pair', 'ratio', 'minimum', 'criterion'].map((key) =>
      element('th', { text: text.contrast[key] }),
    ),
    element('th'),
  ]);
  const rows = CONTRAST_RULES.flatMap((rule) =>
    rule.foregrounds.flatMap((foreground) =>
      rule.backgrounds.map((background) =>
        element('tr', { dataset: { foreground, background, minimum: String(rule.minimum) } }, [
          element('td', {}, [
            element('span', {
              class: 'pair',
              style: { color: `var(${foreground})`, background: `var(${background})` },
              text: 'Aa',
            }),
            element('code', { text: `${foreground} / ${background}` }),
          ]),
          element('td', { class: 'ratio' }),
          element('td', { text: `${rule.minimum}:1` }),
          element('td', { text: rule.criterion }),
          element('td', { class: 'verdict' }),
        ]),
      ),
    ),
  );
  return element('table', { class: 'contrast' }, [
    element('thead', {}, [head]),
    element('tbody', {}, rows),
  ]);
}

function typography(tokens, text) {
  const sizes = tokens.filter((token) => token.startsWith('--ui-text-'));
  const others = tokens.filter((token) => !token.startsWith('--ui-text-'));
  return [
    ...sizes.map((token) =>
      element('p', { class: 'type-sample', style: { fontSize: `var(${token})` } }, [
        element('code', { text: token }),
        ` ${text.sample}`,
      ]),
    ),
    ...others.map(valueRow),
  ];
}

function spacing(tokens) {
  return tokens.map((token) =>
    element('p', { class: 'bar-row' }, [
      element('span', { class: 'bar', style: { width: `var(${token})` } }),
      element('code', { text: token }),
      element('span', { class: 'value', dataset: { token } }),
    ]),
  );
}

function radius(tokens) {
  return tokens.map((token) =>
    element('figure', { class: 'radius-sample' }, [
      element('span', { class: 'corner', style: { borderRadius: `var(${token})` } }),
      element('figcaption', {}, [element('code', { text: token })]),
    ]),
  );
}

function layers(tokens) {
  return [
    element(
      'div',
      { class: 'layer-stack' },
      tokens.map((token, index) =>
        element(
          'div',
          {
            class: 'layer',
            style: {
              zIndex: `var(${token})`,
              insetInlineStart: `calc(var(--ui-space-6) * ${index})`,
              insetBlockStart: `calc(var(--ui-space-8) * ${index} + var(--ui-space-2) * ${index})`,
            },
          },
          [
            element('code', { text: token }),
            element('span', { class: 'value', dataset: { token } }),
          ],
        ),
      ),
    ),
  ];
}

function motion(tokens, text) {
  return tokens.map((token) => {
    const dot = element('span', { class: 'dot', style: { transitionDuration: `var(${token})` } });
    const button = element('button', { type: 'button', text: text.motionPlay });
    button.addEventListener('click', () => dot.classList.toggle('moved'));
    return element('p', { class: 'motion-row' }, [
      button,
      element('span', { class: 'track' }, [dot]),
      element('code', { text: token }),
      element('span', { class: 'value', dataset: { token } }),
    ]);
  });
}

function sectionBody(section, text) {
  if (section.kind === 'swatches')
    return [element('div', { class: 'swatches' }, section.tokens.map(swatch))];
  if (section.kind === 'contrast') return [contrastTable(text)];
  if (section.kind === 'typography') return typography(section.tokens, text);
  if (section.kind === 'spacing') return spacing(section.tokens);
  if (section.kind === 'radius')
    return [element('div', { class: 'swatches' }, radius(section.tokens))];
  if (section.kind === 'layers') return layers(section.tokens);
  if (section.kind === 'motion') return motion(section.tokens, text);
  return section.tokens.map(valueRow);
}

function refresh(text) {
  for (const node of document.querySelectorAll('.value[data-token]'))
    node.textContent = tokenValue(node.dataset.token);
  for (const row of document.querySelectorAll('tr[data-foreground]')) {
    const ratio = contrastRatio(
      tokenValue(row.dataset.foreground),
      tokenValue(row.dataset.background),
    );
    const passed = ratio >= Number(row.dataset.minimum);
    row.querySelector('.ratio').textContent = `${ratio.toFixed(2)}:1`;
    const verdict = row.querySelector('.verdict');
    verdict.textContent = passed ? text.contrast.pass : text.contrast.fail;
    verdict.dataset.passed = String(passed);
  }
}

function applyAccent(accent, text) {
  root.style.removeProperty('--ui-accent');
  const note = document.getElementById('accent-note');
  note.textContent = '';
  if (!accent) return;
  const surfaces = ACCENT_SURFACES.map(tokenValue).filter((value) =>
    /^#[\da-f]{3,8}$/i.test(value),
  );
  const readable = readableAccent(accent, surfaces, { onAccent: tokenValue('--ui-on-action') });
  if (!readable) return;
  root.style.setProperty('--ui-accent', readable);
  if (readable !== accent)
    note.textContent = text.controls.accentAdjusted
      .replace('{from}', accent)
      .replace('{to}', readable);
}

function controls(text, recipes) {
  const accent = element('select', { name: 'accent' }, [
    element('option', { value: '', text: text.controls.accentDefault }),
    ...recipes.map((recipe) =>
      element('option', { value: recipe.palette.accent[0], text: recipe.name ?? recipe.id }),
    ),
  ]);
  const quality = element(
    'select',
    { name: 'quality' },
    QUALITIES.map((level) =>
      element('option', { value: level, text: text.controls[`quality-${level}`] }),
    ),
  );
  quality.value = 'medium';
  const transparency = element('input', { type: 'checkbox', name: 'transparency' });
  const reducedMotion = element('input', { type: 'checkbox', name: 'motion' });
  const update = () => {
    root.dataset.uiQuality = quality.value;
    if (transparency.checked) root.dataset.uiTransparency = 'reduced';
    else delete root.dataset.uiTransparency;
    if (reducedMotion.checked) root.dataset.uiMotion = 'reduced';
    else delete root.dataset.uiMotion;
    applyAccent(accent.value, text);
    refresh(text);
  };
  for (const input of [accent, quality, transparency, reducedMotion])
    input.addEventListener('change', update);
  const form = document.getElementById('controls');
  form.append(
    element('label', {}, [text.controls.accent, accent]),
    element('label', {}, [text.controls.quality, quality]),
    element('label', { class: 'toggle' }, [transparency, text.controls.transparency]),
    element('label', { class: 'toggle' }, [reducedMotion, text.controls.motion]),
  );
  update();
}

async function start() {
  let text;
  let registry;
  try {
    text = await (await fetch(new URL('./text.json', import.meta.url))).json();
    registry = await (await fetch(new URL('../components/registry.json', import.meta.url))).json();
  } catch {
    document.body.textContent = 'Library data could not be loaded.';
    return;
  }
  document.title = text.title;
  document.getElementById('title').textContent = text.title;
  document.getElementById('intro').textContent = text.intro;
  document
    .getElementById('links')
    .append(
      ...Object.entries(LINKS).map(([key, href]) => element('a', { href, text: text.links[key] })),
    );
  document
    .getElementById('sections')
    .append(
      componentShowcase(text.components, registry),
      ...librarySections().map((section) =>
        element('section', { id: section.id, class: 'panel' }, [
          element('h2', { text: text.sections[section.id] }),
          ...sectionBody(section, text),
        ]),
      ),
    );
  controls(text, await loadRecipes());
}

start();
