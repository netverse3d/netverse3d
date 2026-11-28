import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { createContext, useContext, useId, type ReactElement, type ReactNode } from 'react';
import { Icon, type IconName } from './icon.tsx';
import { useLayerContainer } from './layer.ts';
import { classNames } from './shared.ts';

export type OverlaySide = 'top' | 'right' | 'bottom' | 'left';
export type OverlayAlign = 'start' | 'center' | 'end';

type OpenState = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type Placement = { side?: OverlaySide; align?: OverlayAlign };

const TOOLTIP_DELAY_MS = 300;
const LAYER_GAP = 8;
const SCREEN_EDGE = 8;
const ARROW = { width: 14, height: 7 };

const TooltipGroupContext = createContext(false);

export type TooltipGroupProps = { children: ReactNode; className?: string };

export function TooltipGroup({ children, className }: TooltipGroupProps) {
  return (
    <div className={classNames('nv-tooltip-group', className)}>
      <TooltipPrimitive.Provider delayDuration={TOOLTIP_DELAY_MS}>
        <TooltipGroupContext.Provider value={true}>{children}</TooltipGroupContext.Provider>
      </TooltipPrimitive.Provider>
    </div>
  );
}

export type TooltipProps = OpenState & {
  content: ReactNode;
  children: ReactElement;
  side?: OverlaySide;
};

export function Tooltip({ content, children, side = 'top', ...openState }: TooltipProps) {
  const [findContainer, container] = useLayerContainer();
  const grouped = useContext(TooltipGroupContext);
  const tooltip = (
    <TooltipPrimitive.Root {...openState}>
      <TooltipPrimitive.Trigger asChild ref={findContainer}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal container={container}>
        <TooltipPrimitive.Content
          className="nv-shape nv-tooltip"
          side={side}
          sideOffset={LAYER_GAP}
          collisionPadding={SCREEN_EDGE}
        >
          {content}
          <TooltipPrimitive.Arrow className="nv-tooltip__arrow" {...ARROW} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
  return grouped ? (
    tooltip
  ) : (
    <TooltipPrimitive.Provider delayDuration={TOOLTIP_DELAY_MS}>
      {tooltip}
    </TooltipPrimitive.Provider>
  );
}

export type PopoverProps = OpenState &
  Placement & {
    trigger: ReactElement;
    title: ReactNode;
    children: ReactNode;
  };

export function Popover({
  trigger,
  title,
  children,
  side = 'bottom',
  align = 'center',
  ...openState
}: PopoverProps) {
  const [findContainer, container] = useLayerContainer();
  const titleId = useId();
  return (
    <PopoverPrimitive.Root {...openState}>
      <PopoverPrimitive.Trigger asChild ref={findContainer}>
        {trigger}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content
          className="nv-shape nv-popover"
          aria-labelledby={titleId}
          side={side}
          align={align}
          sideOffset={LAYER_GAP}
          collisionPadding={SCREEN_EDGE}
        >
          <span className="nv-popover__title" id={titleId}>
            {title}
          </span>
          <div className="nv-popover__body">{children}</div>
          <PopoverPrimitive.Arrow className="nv-popover__arrow" {...ARROW} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export type MenuItem = {
  id: string;
  label: ReactNode;
  icon?: IconName;
  disabled?: boolean;
  onSelect: () => void;
};

export type DropdownMenuProps = OpenState &
  Placement & {
    trigger: ReactElement;
    label: string;
    items: readonly MenuItem[];
  };

export function DropdownMenu({
  trigger,
  label,
  items,
  side = 'bottom',
  align = 'start',
  ...openState
}: DropdownMenuProps) {
  const [findContainer, container] = useLayerContainer();
  return (
    <MenuPrimitive.Root modal={false} {...openState}>
      <MenuPrimitive.Trigger asChild ref={findContainer}>
        {trigger}
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal container={container}>
        <MenuPrimitive.Content
          className="nv-shape nv-menu"
          aria-label={label}
          aria-labelledby={undefined}
          side={side}
          align={align}
          sideOffset={LAYER_GAP}
          collisionPadding={SCREEN_EDGE}
          loop
        >
          {items.map((item) => (
            <MenuPrimitive.Item
              key={item.id}
              className="nv-menu__item"
              disabled={item.disabled}
              onSelect={item.onSelect}
              data-item={item.id}
            >
              {item.icon && <Icon name={item.icon} />}
              <span>{item.label}</span>
            </MenuPrimitive.Item>
          ))}
          <MenuPrimitive.Arrow className="nv-menu__arrow" {...ARROW} />
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
