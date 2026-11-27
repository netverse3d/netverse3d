import * as ToastPrimitive from '@radix-ui/react-toast';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconButton } from './actions.tsx';
import { Badge } from './feedback.tsx';
import { Icon } from './icon.tsx';
import { classNames } from './shared.ts';

export type ToastTone = 'error' | 'warning' | 'info';

export type ToastItem = {
  id: string | number;
  name?: string;
  tone: ToastTone;
  message: ReactNode;
  action?: { label: string; onAction: () => void };
};

export type ToastStackProps = {
  items: readonly ToastItem[];
  label: string;
  closeLabel: string;
  onDismiss: (id: ToastItem['id']) => void;
  className?: string;
};

const SHAPE_TONE: Record<ToastTone, string> = {
  error: 'danger',
  warning: 'warning',
  info: 'cyan',
};

const TONE_ICON = { error: 'alert', warning: 'alert', info: 'bell' } as const;

export function ToastStack({ items, label, closeLabel, onDismiss, className }: ToastStackProps) {
  return (
    <ToastPrimitive.Provider label={label} duration={Number.POSITIVE_INFINITY} swipeDirection="up">
      {items.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          open
          type={item.tone === 'error' ? 'foreground' : 'background'}
          onOpenChange={(open) => {
            if (!open) onDismiss(item.id);
          }}
          className="nv-shape nv-toast nv-toast-stack__item"
          data-tone={SHAPE_TONE[item.tone]}
          data-duo="magenta"
          data-notice-tone={item.tone}
          data-notice={item.name}
        >
          <span className="nv-toast-stack__icon" aria-hidden="true">
            <Icon name={TONE_ICON[item.tone]} />
          </span>
          <ToastPrimitive.Description className="nv-toast-stack__message">
            {item.message}
          </ToastPrimitive.Description>
          {item.action && (
            <ToastPrimitive.Action
              altText={item.action.label}
              className="nv-toast-stack__action"
              onClick={item.action.onAction}
            >
              {item.action.label}
            </ToastPrimitive.Action>
          )}
          <ToastPrimitive.Close asChild>
            <IconButton icon="close" label={closeLabel} surface="ghost" tone="neutral" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className={classNames('nv-toast-stack', className)} />
    </ToastPrimitive.Provider>
  );
}

export type NotificationBellProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'style' | 'children' | 'aria-label'
> & {
  count: number;
  label: string;
};

const MAX_SHOWN_COUNT = 99;

export function NotificationBell({ count, label, className, ...native }: NotificationBellProps) {
  return (
    <span className={classNames('nv-bell', className)}>
      <IconButton {...native} icon="bell" label={label} tone="cyan" surface="glass" />
      {count > 0 && (
        <Badge className="nv-bell__count" tone="magenta" aria-hidden="true">
          {count > MAX_SHOWN_COUNT ? `${MAX_SHOWN_COUNT}+` : count}
        </Badge>
      )}
    </span>
  );
}
