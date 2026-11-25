import { useState, type ReactNode } from 'react';
import {
  ActionButton,
  Alert,
  Button,
  IconButton,
  KeyHint,
  Panel,
  Spinner,
  Text,
} from '../react/index.ts';
import { componentProps, registeredComponents } from '../src/registry.mjs';
import registry from '../components/registry.json';
import {
  DEMOS,
  initialValues,
  LoginForm,
  PlayerDemo,
  QuestPanel,
  ShopDemo,
  type ComponentText,
  type DemoValues,
} from './demos.tsx';

type Entry = Parameters<typeof initialValues>[1] & {
  react: string;
  className: string;
  criteria: string[];
};

const entries = registeredComponents(registry) as Entry[];
const SURFACES = ['filled', 'glass', 'neon', 'ghost'] as const;
const STATES = ['idle', 'pending', 'disabled'] as const;

function Scene({ text }: { text: ComponentText }) {
  const icons = ['bell', 'friends', 'bag', 'gear'] as const;
  return (
    <div className="nv-scene">
      <div className="nv-scene__top">
        <PlayerDemo text={text} />
        <div className="nv-scene__icons">
          {icons.map((name) => (
            <IconButton key={name} icon={name} label={text.icons[name]} tone="magenta" />
          ))}
        </div>
      </div>
      <div className="nv-scene__middle">
        <QuestPanel text={text} />
        <ShopDemo text={text} />
      </div>
      <div className="nv-scene__bottom">
        <KeyHint keyLabel="E" tone="accent" surface="glass">
          {text.interact}
        </KeyHint>
        <div className="nv-scene__actions">
          <ActionButton icon="run" label={text.actions.run} keyLabel="Shift" />
          <ActionButton icon="chat" label={text.actions.chat} keyLabel="C" />
          <ActionButton icon="camera" label={text.actions.camera} keyLabel="V" />
        </div>
      </div>
    </div>
  );
}

function ButtonMatrix({ text }: { text: ComponentText }) {
  return (
    <div className="nv-matrix">
      <span />
      {STATES.map((state) => (
        <span key={state} className="nv-matrix__head">
          {text.states[state]}
        </span>
      ))}
      {SURFACES.map((surface) => [
        <code key={surface}>{surface}</code>,
        ...STATES.map((state) => (
          <span key={`${surface}-${state}`}>
            <Button surface={surface} state={state}>
              {text.buttonLabel}
            </Button>
          </span>
        )),
      ])}
    </div>
  );
}

function LoginPreview({ text }: { text: ComponentText }) {
  return (
    <div className="nv-dialog-frame">
      <Panel
        as="div"
        className="nv-dialog"
        shape="bevel-all"
        cut="lg"
        tone="primary"
        duo="magenta"
        surface="solid"
        title={text.login}
        titleLevel={3}
        action={<IconButton icon="close" label={text.icons.close} tone="neutral" surface="glass" />}
      >
        <LoginForm text={text} />
      </Panel>
    </div>
  );
}

function Pattern({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="nv-pattern">
      <div className="nv-pattern__stage">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function SeatHint({ label, pending = false }: { label: string; pending?: boolean }) {
  return (
    <KeyHint keyLabel="E" tone="accent" surface="glass">
      {pending && <Spinner />}
      {label}
    </KeyHint>
  );
}

function InteractionPatterns({ text }: { text: ComponentText }) {
  const patterns = text.patterns;
  return (
    <div className="nv-patterns">
      <Pattern caption={patterns.idleCaption}>
        <SeatHint label={patterns.idle} />
      </Pattern>
      <Pattern caption={patterns.pendingCaption}>
        <SeatHint label={patterns.pending} pending />
        <Button state="pending">{patterns.pending}</Button>
      </Pattern>
      <Pattern caption={patterns.deniedCaption}>
        <Alert tone="warning">{patterns.denied}</Alert>
        <SeatHint label={patterns.idle} />
      </Pattern>
      <Pattern caption={patterns.errorCaption}>
        <Alert>{patterns.roomError}</Alert>
      </Pattern>
      <Pattern caption={patterns.sessionCaption}>
        <Panel className="nv-pattern__session" shape="notch" cut="sm" tone="cyan" duo="magenta">
          <Text as="span" variant="label">
            {patterns.sessionLabel}
          </Text>
          <Text as="time" variant="value" tone="warning">
            00:42
          </Text>
          <Button surface="neon" tone="danger" state="pending">
            {patterns.leaving}
          </Button>
        </Panel>
      </Pattern>
      <Pattern caption={patterns.recoveryCaption}>
        <Panel
          shape="bevel-all"
          tone="cyan"
          duo="magenta"
          surface="solid"
          title={patterns.recoveryTitle}
          titleLevel={3}
          action={<Spinner />}
        >
          <Text variant="meta">{patterns.recoveryBody}</Text>
        </Panel>
      </Pattern>
    </div>
  );
}

function Playground({ text }: { text: ComponentText }) {
  const [targetId, setTargetId] = useState(entries[0]?.id ?? '');
  const target = entries.find((entry) => entry.id === targetId) ?? entries[0];
  const [values, setValues] = useState<DemoValues>(() =>
    target ? initialValues(registry, target) : {},
  );
  if (!target) return null;
  const options = componentProps(registry, target) as Record<string, string[]>;
  const Demo = DEMOS[target.demo];
  const attributes = Object.entries(values).map(([key, value]) => `  ${key}="${value}"`);
  const code = attributes.length
    ? [`<${target.react}`, ...attributes, '/>'].join('\n')
    : `<${target.react} />`;
  const labels = text.props as Record<string, string>;
  return (
    <div className="nv-playground">
      <div className="nv-playground__controls">
        <label>
          {text.playgroundTarget}
          <select
            name="target"
            value={target.id}
            onChange={(event) => {
              const next = entries.find((entry) => entry.id === event.target.value);
              if (!next) return;
              setTargetId(next.id);
              setValues(initialValues(registry, next));
            }}
          >
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.react}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="nv-playground__controls">
        {Object.entries(options).map(([key, list]) => (
          <label key={key}>
            {labels[key] ?? key}
            <select
              name={key}
              value={values[key]}
              onChange={(event) => setValues({ ...values, [key]: event.target.value })}
            >
              {list.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="nv-playground__body">
        <div className="nv-playground__stage">
          {Demo && <Demo key={target.id} text={text} values={values} />}
        </div>
        <figure>
          <figcaption>{text.code}</figcaption>
          <pre className="nv-playground__code">{code}</pre>
        </figure>
      </div>
    </div>
  );
}

function RegistryTable({ text }: { text: ComponentText }) {
  return (
    <table className="contrast">
      <thead>
        <tr>
          {text.registryColumns.map((label) => (
            <th key={label}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td>
              <code>{entry.react}</code>
            </td>
            <td>
              <code>{entry.className}</code>
            </td>
            <td>{Object.keys(componentProps(registry, entry)).join(', ')}</td>
            <td>{entry.criteria.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ComponentShowcase({ text }: { text: ComponentText }) {
  return (
    <section id="components" className="panel">
      <h2>{text.title}</h2>
      <p className="lead">{text.intro}</p>
      <h3 className="library-subhead">{text.scene}</h3>
      <Scene text={text} />
      <h3 className="library-subhead">{text.buttons}</h3>
      <ButtonMatrix text={text} />
      <h3 className="library-subhead">{text.form}</h3>
      <LoginPreview text={text} />
      <h3 className="library-subhead">{text.patterns.title}</h3>
      <p className="lead">{text.patterns.intro}</p>
      <InteractionPatterns text={text} />
      <h3 className="library-subhead">{text.playground}</h3>
      <Playground text={text} />
      <h3 className="library-subhead">{text.registry}</h3>
      <p className="lead">{text.registryIntro}</p>
      <RegistryTable text={text} />
    </section>
  );
}
