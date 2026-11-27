export interface PanelVariants {
  shape?: 'bevel' | 'bevel-all' | 'notch' | 'round' | 'pill' | 'hex';
  cut?: 'md' | 'sm' | 'lg';
  tone?: 'accent' | 'primary' | 'magenta' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral';
  duo?: 'none' | 'magenta' | 'cyan';
  surface?: 'glass' | 'solid' | 'neon' | 'filled' | 'ghost';
  glow?: 'soft' | 'none' | 'strong';
}

export interface ButtonVariants {
  shape?: 'bevel' | 'bevel-all' | 'notch' | 'round' | 'pill' | 'hex';
  cut?: 'md' | 'sm' | 'lg';
  tone?: 'accent' | 'primary' | 'magenta' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral';
  duo?: 'none' | 'magenta' | 'cyan';
  surface?: 'glass' | 'solid' | 'neon' | 'filled' | 'ghost';
  glow?: 'soft' | 'none' | 'strong';
  size?: 'md' | 'sm' | 'lg';
  state?: 'idle' | 'pending' | 'disabled';
}

export interface IconButtonVariants {
  shape?: 'bevel' | 'bevel-all' | 'notch' | 'round' | 'pill' | 'hex';
  cut?: 'md' | 'sm' | 'lg';
  tone?: 'accent' | 'primary' | 'magenta' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral';
  duo?: 'none' | 'magenta' | 'cyan';
  surface?: 'glass' | 'solid' | 'neon' | 'filled' | 'ghost';
  glow?: 'soft' | 'none' | 'strong';
  size?: 'md' | 'lg';
}

export interface TextFieldVariants {
  state?: 'idle' | 'error' | 'disabled';
}

export type CheckboxVariants = Record<never, never>;

export interface ShopCardVariants {
  shape?: 'bevel' | 'bevel-all' | 'notch' | 'round' | 'pill' | 'hex';
  cut?: 'md' | 'sm' | 'lg';
  tone?: 'accent' | 'primary' | 'magenta' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral';
  duo?: 'none' | 'magenta' | 'cyan';
  surface?: 'glass' | 'solid' | 'neon' | 'filled' | 'ghost';
  glow?: 'soft' | 'none' | 'strong';
}

export interface KeyHintVariants {
  shape?: 'bevel' | 'bevel-all' | 'notch' | 'round' | 'pill' | 'hex';
  cut?: 'md' | 'sm' | 'lg';
  tone?: 'accent' | 'primary' | 'magenta' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral';
  duo?: 'none' | 'magenta' | 'cyan';
  surface?: 'glass' | 'solid' | 'neon' | 'filled' | 'ghost';
  glow?: 'soft' | 'none' | 'strong';
}

export type KeycapVariants = Record<never, never>;

export type ActionButtonVariants = Record<never, never>;

export interface StatusVariants {
  tone?: 'success' | 'warning' | 'danger';
}

export type MeterVariants = Record<never, never>;

export type AvatarVariants = Record<never, never>;

export interface PlayerBadgeVariants {
  shape?: 'bevel' | 'bevel-all' | 'notch' | 'round' | 'pill' | 'hex';
  cut?: 'md' | 'sm' | 'lg';
  tone?: 'accent' | 'primary' | 'magenta' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral';
  duo?: 'none' | 'magenta' | 'cyan';
  surface?: 'glass' | 'solid' | 'neon' | 'filled' | 'ghost';
  glow?: 'soft' | 'none' | 'strong';
}

export interface DialogVariants {
  size?: 'md' | 'lg';
}

export type OverlayVariants = Record<never, never>;

export type SpinnerVariants = Record<never, never>;

export interface HeadingVariants {
  level?: '2' | '1' | '3';
}

export interface TextVariants {
  variant?: 'body' | 'meta' | 'label' | 'value';
  tone?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'error' | 'highlight';
}

export interface SelectVariants {
  state?: 'idle' | 'disabled';
}

export interface SwitchVariants {
  tone?: 'accent' | 'cyan' | 'magenta' | 'success';
}

export interface RadioGroupVariants {
  direction?: 'column' | 'row';
}

export interface TextareaVariants {
  state?: 'idle' | 'error' | 'disabled';
}

export interface SearchFieldVariants {
  state?: 'idle' | 'disabled';
}

export type TooltipVariants = Record<never, never>;

export type DropdownMenuVariants = Record<never, never>;

export type PopoverVariants = Record<never, never>;

export interface BadgeVariants {
  tone?: 'accent' | 'highlight' | 'magenta';
}

export interface AlertVariants {
  tone?: 'error' | 'warning' | 'info' | 'success';
}

export interface ToastVariants {
  shape?: 'bevel' | 'bevel-all' | 'notch' | 'round' | 'pill' | 'hex';
  cut?: 'md' | 'sm' | 'lg';
  tone?: 'accent' | 'primary' | 'magenta' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral';
  duo?: 'none' | 'magenta' | 'cyan';
  surface?: 'glass' | 'solid' | 'neon' | 'filled' | 'ghost';
  glow?: 'soft' | 'none' | 'strong';
}

export interface ListItemVariants {
  state?: 'read' | 'unread';
}

export type TileVariants = Record<never, never>;

export const VARIANTS = {
  Panel: {"shape":["bevel","bevel-all","notch","round","pill","hex"],"cut":["md","sm","lg"],"tone":["accent","primary","magenta","cyan","success","warning","danger","neutral"],"duo":["none","magenta","cyan"],"surface":["glass","solid","neon","filled","ghost"],"glow":["soft","none","strong"]},
  Button: {"shape":["bevel","bevel-all","notch","round","pill","hex"],"cut":["md","sm","lg"],"tone":["accent","primary","magenta","cyan","success","warning","danger","neutral"],"duo":["none","magenta","cyan"],"surface":["glass","solid","neon","filled","ghost"],"glow":["soft","none","strong"],"size":["md","sm","lg"],"state":["idle","pending","disabled"]},
  IconButton: {"shape":["bevel","bevel-all","notch","round","pill","hex"],"cut":["md","sm","lg"],"tone":["accent","primary","magenta","cyan","success","warning","danger","neutral"],"duo":["none","magenta","cyan"],"surface":["glass","solid","neon","filled","ghost"],"glow":["soft","none","strong"],"size":["md","lg"]},
  TextField: {"state":["idle","error","disabled"]},
  Checkbox: {},
  ShopCard: {"shape":["bevel","bevel-all","notch","round","pill","hex"],"cut":["md","sm","lg"],"tone":["accent","primary","magenta","cyan","success","warning","danger","neutral"],"duo":["none","magenta","cyan"],"surface":["glass","solid","neon","filled","ghost"],"glow":["soft","none","strong"]},
  KeyHint: {"shape":["bevel","bevel-all","notch","round","pill","hex"],"cut":["md","sm","lg"],"tone":["accent","primary","magenta","cyan","success","warning","danger","neutral"],"duo":["none","magenta","cyan"],"surface":["glass","solid","neon","filled","ghost"],"glow":["soft","none","strong"]},
  Keycap: {},
  ActionButton: {},
  Status: {"tone":["success","warning","danger"]},
  Meter: {},
  Avatar: {},
  PlayerBadge: {"shape":["bevel","bevel-all","notch","round","pill","hex"],"cut":["md","sm","lg"],"tone":["accent","primary","magenta","cyan","success","warning","danger","neutral"],"duo":["none","magenta","cyan"],"surface":["glass","solid","neon","filled","ghost"],"glow":["soft","none","strong"]},
  Dialog: {"size":["md","lg"]},
  Overlay: {},
  Spinner: {},
  Heading: {"level":["2","1","3"]},
  Text: {"variant":["body","meta","label","value"],"tone":["default","muted","info","success","warning","error","highlight"]},
  Select: {"state":["idle","disabled"]},
  Switch: {"tone":["accent","cyan","magenta","success"]},
  RadioGroup: {"direction":["column","row"]},
  Textarea: {"state":["idle","error","disabled"]},
  SearchField: {"state":["idle","disabled"]},
  Tooltip: {},
  DropdownMenu: {},
  Popover: {},
  Badge: {"tone":["accent","highlight","magenta"]},
  Alert: {"tone":["error","warning","info","success"]},
  Toast: {"shape":["bevel","bevel-all","notch","round","pill","hex"],"cut":["md","sm","lg"],"tone":["accent","primary","magenta","cyan","success","warning","danger","neutral"],"duo":["none","magenta","cyan"],"surface":["glass","solid","neon","filled","ghost"],"glow":["soft","none","strong"]},
  ListItem: {"state":["read","unread"]},
  Tile: {},
} as const;
