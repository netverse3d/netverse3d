import { useState, type ReactNode } from 'react';
import {
  ActionButton,
  Alert,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DropdownMenu,
  Heading,
  IconButton,
  KeyHint,
  Keycap,
  ListItem,
  Meter,
  Overlay,
  Pagination,
  Panel,
  PlayerBadge,
  Popover,
  RadioGroup,
  SearchField,
  SegmentedControl,
  Select,
  ShopCard,
  Spinner,
  Status,
  Switch,
  Tabs,
  Text,
  TextLink,
  Textarea,
  TextField,
  Tile,
  Toast,
  Tooltip,
} from '../react/index.ts';
import { Icon } from '../react/icon.tsx';
import { componentProps } from '../src/registry.mjs';
import shopImage from './media/shop.jpg';
import type libraryText from './text.json';

export type ComponentText = (typeof libraryText)['components'];
export type DemoValues = Record<string, string>;
export type DemoProps = { text: ComponentText; values: DemoValues; closed?: boolean };
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
        <TextLink href="#components">{text.signup}</TextLink>
        <TextLink href="#components">{text.forgot}</TextLink>
      </div>
    </>
  );
}

function SearchDemo({ text, values }: DemoProps) {
  const [query, setQuery] = useState(text.searchSample);
  return (
    <SearchField
      {...variants(values)}
      label={text.searchLabel}
      placeholder={text.searchPlaceholder}
      value={query}
      onValueChange={setQuery}
      clearLabel={text.clear}
    />
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

const MENU_ICONS = { sit: 'monitor', invite: 'friends', report: 'gear' } as const;

function MenuDemo({ text, closed }: DemoProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <DropdownMenu
      defaultOpen={!closed}
      label={text.menuLabel}
      trigger={<Button size="sm">{chosen ?? text.menuTrigger}</Button>}
      items={Object.entries(MENU_ICONS).map(([id, icon]) => ({
        id,
        icon,
        label: text.menuItems[id as keyof typeof MENU_ICONS],
        onSelect: () => setChosen(text.menuItems[id as keyof typeof MENU_ICONS]),
      }))}
    />
  );
}

const TAB_KEYS = ['stats', 'items', 'friends'] as const;
const SEGMENT_KEYS = ['day', 'week', 'month'] as const;
const DEMO_PAGES = 5;

function PaginationDemo({ text }: DemoProps) {
  const [page, setPage] = useState(1);
  return (
    <Pagination
      page={page}
      totalPages={DEMO_PAGES}
      onPageChange={setPage}
      label={text.pagesLabel}
      previousLabel={text.previous}
      nextLabel={text.next}
      pageLabel={(current, total) =>
        text.pageOf.replace('{page}', String(current)).replace('{total}', String(total))
      }
    />
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
    <Select
      {...variants(values)}
      label={text.selectLabel}
      defaultValue={text.selectOptions[1]}
      options={text.selectOptions.map((option) => ({ value: option, label: option }))}
    />
  ),
  switch: ({ text, values }) => (
    <Switch {...variants(values)} label={text.switchLabel} defaultChecked />
  ),
  'radio-group': ({ text, values }) => (
    <RadioGroup
      {...variants(values)}
      label={text.radioLabel}
      defaultValue={text.radioOptions[0]}
      options={text.radioOptions.map((option) => ({ value: option, label: option }))}
    />
  ),
  textarea: ({ text, values }) => (
    <Textarea
      {...variants(values)}
      label={text.textareaLabel}
      placeholder={text.textareaPlaceholder}
      message={values.state === 'error' ? text.passwordError : undefined}
    />
  ),
  search: (props) => <SearchDemo {...props} />,
  tooltip: ({ text, closed }) => (
    <Tooltip content={text.tooltipSample} defaultOpen={!closed}>
      <IconButton icon="bell" label={text.icons.bell} />
    </Tooltip>
  ),
  'dropdown-menu': (props) => <MenuDemo {...props} />,
  tabs: ({ text }) => (
    <Tabs
      label={text.tabsLabel}
      items={TAB_KEYS.map((key) => ({
        value: key,
        label: text.tabs[key],
        content: <Text>{text.tabsBody[key]}</Text>,
      }))}
    />
  ),
  'segmented-control': ({ text }) => (
    <SegmentedControl
      label={text.segmentedLabel}
      defaultValue="week"
      options={SEGMENT_KEYS.map((key) => ({ value: key, label: text.segments[key] }))}
    />
  ),
  pagination: (props) => <PaginationDemo {...props} />,
  'text-link': ({ text, values }) => (
    <TextLink {...variants(values)} href="#components">
      {text.linkSample}
    </TextLink>
  ),
  popover: ({ text, closed }) => (
    <Popover
      defaultOpen={!closed}
      title={text.popoverTitle}
      trigger={
        <Button size="sm" surface="ghost">
          {text.popoverTrigger}
        </Button>
      }
    >
      {text.popoverBody}
    </Popover>
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
