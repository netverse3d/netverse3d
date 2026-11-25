import { element } from './dom.mjs';
import { icon } from './icons.mjs';
import { componentProps, registeredComponents } from '../src/registry.mjs';

const DEMO_DEFAULTS = {
  button: { shape: 'bevel', surface: 'filled', duo: 'magenta' },
  panel: { shape: 'bevel', surface: 'glass', duo: 'cyan' },
  input: { shape: 'bevel' },
  card: { shape: 'bevel-all', surface: 'glass', duo: 'cyan', cut: 'lg' },
  icon: { shape: 'hex', surface: 'neon', tone: 'cyan' },
  'key-hint': { shape: 'bevel', surface: 'glass', duo: 'cyan' },
  profile: { shape: 'notch', tone: 'magenta', duo: 'cyan', cut: 'sm' },
  dialog: { shape: 'bevel-all', cut: 'lg', tone: 'primary', duo: 'magenta', surface: 'solid' },
};

function shape(tag, className, props = {}, children = [], extra = {}) {
  const dataset = Object.fromEntries(
    Object.entries(props).filter(
      ([, value]) => value !== undefined && value !== 'none' && value !== 'idle',
    ),
  );
  return element(tag, { class: `nv-shape ${className}`, dataset, ...extra }, children);
}

function iconButton(name, label, props = {}) {
  return shape(
    'button',
    'nv-icon-button',
    { shape: 'bevel', tone: 'cyan', surface: 'neon', ...props },
    [icon(name)],
    {
      type: 'button',
      'aria-label': label,
    },
  );
}

function button(label, props = {}) {
  const pending = props.state === 'pending';
  return shape(
    'button',
    'nv-button',
    { shape: 'bevel', tone: 'accent', surface: 'filled', duo: 'magenta', ...props },
    [...(pending ? [element('span', { class: 'nv-spinner', 'aria-hidden': 'true' })] : []), label],
    {
      type: 'button',
      disabled: props.state === 'disabled',
      'aria-busy': pending ? 'true' : undefined,
    },
  );
}

function questPanel(text, props = {}) {
  return shape('section', 'nv-panel', { shape: 'bevel', tone: 'accent', duo: 'cyan', ...props }, [
    element('header', { class: 'nv-panel__head' }, [
      element('h3', { class: 'nv-panel__title nv-chevrons', text: text.quests }),
      element('span', { class: 'nv-panel__meta', text: text.questCount }),
    ]),
    checkRow(text.questDone, true),
    checkRow(text.questOpen, false),
  ]);
}

function checkRow(label, checked) {
  return element('label', { class: 'nv-check' }, [
    element('input', { type: 'checkbox', checked }),
    shape('span', 'nv-check__box', { shape: 'bevel' }, [
      element('span', { class: 'nv-check__mark' }),
    ]),
    label,
  ]);
}

function profile(text) {
  return shape(
    'div',
    'nv-panel nv-profile',
    { shape: 'notch', tone: 'magenta', duo: 'cyan', cut: 'sm' },
    [
      element('div', { class: 'nv-profile__row' }, [
        element('span', { class: 'nv-avatar', 'aria-hidden': 'true' }),
        element('div', { class: 'nv-profile__text' }, [
          element('strong', { text: text.player }),
          element('span', { class: 'nv-panel__meta', text: text.level }),
          element('div', { class: 'nv-meter' }, [
            element('div', { class: 'nv-meter__fill', style: { width: '64%' } }),
          ]),
        ]),
      ]),
    ],
  );
}

function shopCard(text, props = {}) {
  return shape(
    'article',
    'nv-card',
    { shape: 'bevel-all', cut: 'lg', tone: 'accent', duo: 'cyan', ...props },
    [
      shape('div', 'nv-card__media', { shape: 'bevel', tone: 'cyan', surface: 'solid' }, [
        element('img', {
          src: new URL('./media/shop.jpg', import.meta.url).href,
          alt: '',
          loading: 'lazy',
        }),
      ]),
      element('div', { class: 'nv-card__body' }, [
        element('h3', { class: 'nv-card__title', text: text.shopName }),
        element('p', { class: 'nv-card__about', text: text.shopAbout }),
        element('span', { class: 'nv-card__row' }, [icon('monitor'), text.shopKind]),
        element('span', { class: 'nv-card__row' }, [icon('seats'), text.shopSeats]),
        element('div', { class: 'nv-card__foot' }, [
          element('span', { class: 'nv-status', text: text.shopOpen }),
          iconButton('chevron', text.icons.chevron, { shape: 'bevel', size: undefined }),
        ]),
      ]),
    ],
  );
}

function field(label, props, extra) {
  return element(
    'label',
    {
      class: 'nv-field',
      dataset: props.state && props.state !== 'idle' ? { state: props.state } : {},
    },
    [
      element('span', { class: 'nv-field__label', text: label }),
      shape('span', 'nv-input', { shape: props.shape ?? 'bevel', cut: props.cut }, [
        element('input', {
          type: extra.type ?? 'text',
          placeholder: extra.placeholder,
          disabled: props.state === 'disabled',
        }),
      ]),
      ...(extra.message ? [element('p', { class: 'nv-field__message', text: extra.message })] : []),
    ],
  );
}

function loginDialog(text) {
  return shape(
    'section',
    'nv-panel nv-dialog',
    { shape: 'bevel-all', cut: 'lg', tone: 'primary', duo: 'magenta', surface: 'solid' },
    [
      element('header', { class: 'nv-panel__head' }, [
        element('h3', { class: 'nv-panel__title nv-chevrons', text: text.login }),
        iconButton('close', text.icons.close, {
          shape: 'bevel',
          tone: 'neutral',
          surface: 'glass',
        }),
      ]),
      field(text.email, {}, { type: 'email', placeholder: text.emailPlaceholder }),
      field(text.password, { state: 'error' }, { type: 'password', message: text.passwordError }),
      button(text.login, { size: 'lg', block: '' }),
      element('div', { class: 'nv-dialog__links' }, [
        element('a', { href: '#', text: text.signup }),
        element('a', { href: '#', text: text.forgot }),
      ]),
    ],
  );
}

function hexAction(name, label, key) {
  return element('span', { class: 'nv-action' }, [
    iconButton(name, label, { shape: 'hex', surface: 'neon', tone: 'cyan', duo: 'magenta' }),
    element('span', { text: label }),
    element('kbd', { class: 'nv-keycap', text: key }),
  ]);
}

function scene(text) {
  return element('div', { class: 'nv-scene' }, [
    element('div', { class: 'nv-scene__top' }, [
      profile(text),
      element('div', { class: 'nv-scene__icons' }, [
        iconButton('bell', text.icons.bell, { tone: 'magenta' }),
        iconButton('friends', text.icons.friends, { tone: 'magenta' }),
        iconButton('bag', text.icons.bag, { tone: 'magenta' }),
        iconButton('gear', text.icons.gear, { tone: 'magenta' }),
      ]),
    ]),
    element('div', { class: 'nv-scene__middle' }, [questPanel(text), shopCard(text)]),
    element('div', { class: 'nv-scene__bottom' }, [
      shape(
        'span',
        'nv-key-hint',
        { shape: 'bevel', tone: 'accent', duo: 'cyan', surface: 'glass' },
        [element('kbd', { class: 'nv-keycap', text: 'E' }), text.interact],
      ),
      element('div', { class: 'nv-scene__actions' }, [
        hexAction('run', text.actions.run, 'Shift'),
        hexAction('chat', text.actions.chat, 'C'),
        hexAction('camera', text.actions.camera, 'V'),
      ]),
    ]),
  ]);
}

function buttonMatrix(text) {
  const surfaces = ['filled', 'glass', 'neon', 'ghost'];
  const states = ['idle', 'pending', 'disabled'];
  return element('div', { class: 'nv-matrix' }, [
    element('span'),
    ...states.map((state) =>
      element('span', { class: 'nv-matrix__head', text: text.states[state] }),
    ),
    ...surfaces.flatMap((surface) => [
      element('code', { text: surface }),
      ...states.map((state) => element('span', {}, [button(text.buttonLabel, { surface, state })])),
    ]),
  ]);
}

const DEMO_BUILDERS = {
  panel: (text, props) => questPanel(text, props),
  button: (text, props) => button(text.buttonLabel, props),
  icon: (text, props) => iconButton('bell', text.icons.bell, props),
  input: (text, props) =>
    field(text.email, props, {
      type: 'email',
      placeholder: text.emailPlaceholder,
      message: props.state === 'error' ? text.passwordError : undefined,
    }),
  checkbox: (text) => checkRow(text.questDone, true),
  card: (text, props) => shopCard(text, props),
  'key-hint': (text, props) =>
    shape('span', 'nv-key-hint', { tone: 'accent', ...props }, [
      element('kbd', { class: 'nv-keycap', text: 'E' }),
      text.interact,
    ]),
  action: (text) => hexAction('run', text.actions.run, 'Shift'),
  profile: (text) => profile(text),
  dialog: (text) => loginDialog(text),
  heading: (text, props) =>
    element('h2', { class: 'nv-heading', dataset: dataFor(props) }, [text.headingSample]),
  text: (text, props) =>
    element('p', { class: 'nv-text', dataset: dataFor(props) }, [text.textSample]),
  select: (text, props) =>
    element('label', { class: 'nv-field', dataset: dataFor(props) }, [
      element('span', { class: 'nv-field__label', text: text.selectLabel }),
      shape('span', 'nv-input', { shape: 'bevel' }, [
        element(
          'select',
          { disabled: props.state === 'disabled' },
          text.selectOptions.map((option) => element('option', { text: option })),
        ),
        icon('chevronDown'),
      ]),
    ]),
  badge: (text, props) =>
    element('span', { class: 'nv-badge', dataset: dataFor(props) }, [text.badgeSample]),
  alert: (text, props) =>
    element('p', { class: 'nv-alert', role: 'alert', dataset: dataFor(props) }, [text.alertSample]),
  toast: (text, props) =>
    shape('div', 'nv-toast', { shape: 'bevel', tone: 'cyan', ...props }, [text.toastSample], {
      role: 'status',
    }),
  'list-item': (text, props) =>
    element('ul', { class: 'nv-demo-list' }, [
      shape('li', 'nv-list-item', { state: props.state ?? 'unread' }, [
        element('strong', { text: text.listTitle }),
        element('span', { class: 'nv-text', dataset: { variant: 'meta' }, text: text.listBody }),
      ]),
    ]),
  tile: (text) => shape('div', 'nv-tile', {}, [icon('monitor'), text.tileSample]),
  overlay: (text) =>
    element('div', { class: 'nv-overlay-frame' }, [
      element('div', { class: 'nv-scrim' }, [
        shape('div', 'nv-toast', { shape: 'bevel', tone: 'cyan' }, [text.toastSample]),
      ]),
    ]),
};

function dataFor(props) {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([, value]) => value !== undefined && !['none', 'idle', 'default'].includes(value),
    ),
  );
}

export const DEMO_IDS = Object.keys(DEMO_BUILDERS);

function playground(text, registry) {
  const entries = registeredComponents(registry);
  const stage = element('div', { class: 'nv-playground__stage' });
  const code = element('pre', { class: 'nv-playground__code' });
  const targetSelect = element(
    'select',
    { name: 'target' },
    entries.map((entry) => element('option', { value: entry.id, text: entry.react })),
  );
  const controls = element('div', { class: 'nv-playground__controls' });
  let values = {};

  const current = () => entries.find((entry) => entry.id === targetSelect.value);

  const render = () => {
    const entry = current();
    stage.replaceChildren(DEMO_BUILDERS[entry.demo](text, values));
    const attributes = Object.entries(values).map(([key, value]) => `  ${key}="${value}"`);
    code.textContent = attributes.length
      ? [`<${entry.react}`, ...attributes, '/>'].join('\n')
      : `<${entry.react} />`;
  };

  const rebuildControls = () => {
    const entry = current();
    const options = componentProps(registry, entry);
    values = {
      ...Object.fromEntries(Object.entries(options).map(([key, list]) => [key, list[0]])),
      ...Object.fromEntries(
        Object.entries(DEMO_DEFAULTS[entry.demo] ?? {}).filter(([key]) => key in options),
      ),
    };
    controls.replaceChildren(
      ...Object.entries(options).map(([key, list]) => {
        const select = element(
          'select',
          { name: key },
          list.map((option) => element('option', { value: option, text: option })),
        );
        select.value = values[key];
        select.addEventListener('change', () => {
          values[key] = select.value;
          render();
        });
        return element('label', {}, [text.props[key] ?? key, select]);
      }),
    );
    render();
  };

  targetSelect.addEventListener('change', rebuildControls);
  rebuildControls();
  return element('div', { class: 'nv-playground' }, [
    element('div', { class: 'nv-playground__controls' }, [
      element('label', {}, [text.playgroundTarget, targetSelect]),
    ]),
    controls,
    element('div', { class: 'nv-playground__body' }, [
      stage,
      element('figure', {}, [element('figcaption', { text: text.code }), code]),
    ]),
  ]);
}

function registryTable(text, registry) {
  return element('table', { class: 'contrast' }, [
    element('thead', {}, [
      element(
        'tr',
        {},
        text.registryColumns.map((label) => element('th', { text: label })),
      ),
    ]),
    element(
      'tbody',
      {},
      registeredComponents(registry).map((entry) =>
        element('tr', {}, [
          element('td', {}, [element('code', { text: entry.react })]),
          element('td', {}, [element('code', { text: entry.className })]),
          element('td', { text: Object.keys(componentProps(registry, entry)).join(', ') }),
          element('td', { text: entry.criteria.join(', ') }),
        ]),
      ),
    ),
  ]);
}

export function componentShowcase(text, registry) {
  return element('section', { id: 'components', class: 'panel' }, [
    element('h2', { text: text.title }),
    element('p', { class: 'lead', text: text.intro }),
    element('h3', { class: 'library-subhead', text: text.scene }),
    scene(text),
    element('h3', { class: 'library-subhead', text: text.buttons }),
    buttonMatrix(text),
    element('h3', { class: 'library-subhead', text: text.form }),
    element('div', { class: 'nv-dialog-frame' }, [loginDialog(text)]),
    element('h3', { class: 'library-subhead', text: text.playground }),
    playground(text, registry),
    element('h3', { class: 'library-subhead', text: text.registry }),
    element('p', { class: 'lead', text: text.registryIntro }),
    registryTable(text, registry),
  ]);
}
