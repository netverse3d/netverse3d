import { useState, type ReactNode } from 'react';
import {
  ActionButton,
  Alert,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Dialog,
  Heading,
  IconButton,
  KeyHint,
  Keycap,
  ListItem,
  Meter,
  Overlay,
  Panel,
  PlayerBadge,
  SelectField,
  ShopCard,
  Spinner,
  Status,
  Text,
  TextField,
  Tile,
  Toast,
} from '../react/index.ts';
import { Icon } from '../react/icon.tsx';
import { componentProps } from '../src/registry.mjs';
import shopImage from './media/shop.jpg';
import type libraryText from './text.json';

export type ComponentText = (typeof libraryText)['components'];
export type DemoValues = Record<string, string>;
export type DemoProps = { text: ComponentText; values: DemoValues };
export type RegistryEntry = {
  id: string;
  demo: string;
  uses: string[];
  props: Record<string, string[]>;
};

const DEMO_DEFAULTS: Record<string, DemoValues> = {
  button: { shape: 'bevel', surface: 'filled', duo: 'magenta' },
  panel: { shape: 'bevel', surface: 'glass', duo: 'cyan' },
  card: { shape: 'bevel-all', surface: 'glass', duo: 'cyan', cut: 'lg' },
  icon: { shape: 'hex', surface: 'neon', tone: 'cyan' },
  'key-hint': { shape: 'bevel', surface: 'glass', duo: 'cyan' },
  profile: { shape: 'notch', tone: 'magenta', duo: 'cyan', cut: 'sm' },
};

function variants(values: DemoValues) {
  return values as Record<string, never>;
}

export function initialValues(registry: object, entry: RegistryEntry): DemoValues {
  const options = componentProps(registry, entry) as Record<string, string[]>;
  const firsts = Object.entries(options).map(([key, list]) => [key, list[0] ?? '']);
  const preferred = Object.entries(DEMO_DEFAULTS[entry.demo] ?? {}).filter(
    ([key]) => key in options,
  );
  return Object.fromEntries([...firsts, ...preferred]);
}

export function QuestPanel({ text, values = {} }: { text: ComponentText; values?: DemoValues }) {
  return (
    <Panel
      shape="bevel"
      tone="accent"
      duo="cyan"
      {...variants(values)}
      title={text.quests}
      titleLevel={3}
      meta={text.questCount}
    >
      <Checkbox label={text.questDone} defaultChecked />
      <Checkbox label={text.questOpen} />
    </Panel>
  );
}

export function PlayerDemo({ text, values = {} }: { text: ComponentText; values?: DemoValues }) {
  return (
    <PlayerBadge
      {...variants(values)}
      name={text.player}
      level={text.level}
      progress={0.64}
      progressLabel={text.level}
    />
  );
}

export function ShopDemo({ text, values = {} }: { text: ComponentText; values?: DemoValues }) {
  return (
    <ShopCard
      tone="accent"
      {...variants(values)}
      name={text.shopName}
      about={text.shopAbout}
      imageSrc={shopImage}
      rows={[
        { icon: 'monitor', label: text.shopKind },
        { icon: 'seats', label: text.shopSeats },
      ]}
      status={text.shopOpen}
      action={<IconButton icon="chevron" label={text.icons.chevron} shape="bevel" />}
    />
  );
}

export function LoginForm({ text }: { text: ComponentText }) {
  return (
    <>
      <TextField label={text.email} type="email" placeholder={text.emailPlaceholder} />
      <TextField label={text.password} type="password" state="error" message={text.passwordError} />
      <Button size="lg" block>
        {text.login}
      </Button>
      <div className="nv-dialog__links">
        <a href="#components">{text.signup}</a>
        <a href="#components">{text.forgot}</a>
      </div>
    </>
  );
}

function DialogDemo({ text, values }: DemoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{text.login}</Button>
      <Dialog
        {...variants(values)}
        open={open}
        title={text.login}
        titleId="library-dialog-title"
        closeLabel={text.icons.close}
        onClose={() => setOpen(false)}
      >
        <LoginForm text={text} />
      </Dialog>
    </>
  );
}

export const DEMOS: Record<string, (props: DemoProps) => ReactNode> = {
  panel: ({ text, values }) => <QuestPanel text={text} values={values} />,
  button: ({ text, values }) => <Button {...variants(values)}>{text.buttonLabel}</Button>,
  icon: ({ text, values }) => (
    <IconButton {...variants(values)} icon="bell" label={text.icons.bell} />
  ),
  input: ({ text, values }) => (
    <TextField
      {...variants(values)}
      label={text.email}
      type="email"
      placeholder={text.emailPlaceholder}
      message={values.state === 'error' ? text.passwordError : undefined}
    />
  ),
  checkbox: ({ text }) => <Checkbox label={text.questDone} defaultChecked />,
  card: ({ text, values }) => <ShopDemo text={text} values={values} />,
  'key-hint': ({ text, values }) => (
    <KeyHint tone="accent" {...variants(values)} keyLabel="E">
      {text.interact}
    </KeyHint>
  ),
  keycap: () => <Keycap>E</Keycap>,
  action: ({ text }) => <ActionButton icon="run" label={text.actions.run} keyLabel="Shift" />,
  status: ({ text, values }) => <Status {...variants(values)}>{text.shopOpen}</Status>,
  meter: ({ text }) => <Meter value={0.64} label={text.level} />,
  avatar: ({ text }) => <Avatar label={text.player} />,
  profile: ({ text, values }) => <PlayerDemo text={text} values={values} />,
  dialog: (props) => <DialogDemo {...props} />,
  overlay: ({ text }) => (
    <div className="nv-overlay-frame">
      <Overlay>
        <Toast shape="bevel">{text.toastSample}</Toast>
      </Overlay>
    </div>
  ),
  spinner: () => <Spinner />,
  heading: ({ text, values }) => <Heading {...variants(values)}>{text.headingSample}</Heading>,
  text: ({ text, values }) => <Text {...variants(values)}>{text.textSample}</Text>,
  select: ({ text, values }) => (
    <SelectField
      {...variants(values)}
      label={text.selectLabel}
      options={text.selectOptions.map((option) => ({ value: option, label: option }))}
    />
  ),
  badge: ({ text, values }) => <Badge {...variants(values)}>{text.badgeSample}</Badge>,
  alert: ({ text, values }) => <Alert {...variants(values)}>{text.alertSample}</Alert>,
  toast: ({ text, values }) => (
    <Toast shape="bevel" {...variants(values)}>
      {text.toastSample}
    </Toast>
  ),
  'list-item': ({ text, values }) => (
    <ul className="nv-demo-list">
      <ListItem state="unread" {...variants(values)}>
        <strong>{text.listTitle}</strong>
        <Text as="span" variant="meta">
          {text.listBody}
        </Text>
      </ListItem>
    </ul>
  ),
  tile: ({ text }) => (
    <Tile>
      <Icon name="monitor" />
      {text.tileSample}
    </Tile>
  ),
};
