import type { IconWeight } from '@phosphor-icons/react';
import {
  ArmchairIcon,
  BackpackIcon,
  BellIcon,
  CameraIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  CheckIcon,
  CornersInIcon,
  CornersOutIcon,
  EnvelopeSimpleIcon,
  GearIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  MonitorIcon,
  PersonSimpleRunIcon,
  PlusIcon,
  UsersThreeIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react/dist/ssr';

const ICONS = {
  bell: BellIcon,
  friends: UsersThreeIcon,
  bag: BackpackIcon,
  gear: GearIcon,
  run: PersonSimpleRunIcon,
  chat: ChatCircleDotsIcon,
  camera: CameraIcon,
  monitor: MonitorIcon,
  seats: ArmchairIcon,
  chevron: CaretRightIcon,
  chevronLeft: CaretLeftIcon,
  chevronDown: CaretDownIcon,
  close: XIcon,
  minimize: CornersInIcon,
  restore: CornersOutIcon,
  mail: EnvelopeSimpleIcon,
  search: MagnifyingGlassIcon,
  check: CheckIcon,
  alert: WarningIcon,
  lock: LockSimpleIcon,
  plus: PlusIcon,
  minus: MinusIcon,
} as const;

export type IconName = keyof typeof ICONS;
export type { IconWeight };

export const ICON_NAMES = Object.keys(ICONS) as IconName[];
export const ICON_WEIGHTS: readonly IconWeight[] = ['regular', 'bold', 'duotone'];
export const ICON_WEIGHT: IconWeight = 'bold';

export function Icon({ name, weight = ICON_WEIGHT }: { name: IconName; weight?: IconWeight }) {
  const Glyph = ICONS[name];
  return <Glyph weight={weight} aria-hidden="true" focusable="false" />;
}
