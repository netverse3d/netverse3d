import { useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
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
  const list = useRef<HTMLOListElement>(null);
  const dismiss = (id: ToastItem['id']) => {
    if (list.current?.contains(document.activeElement)) list.current.focus();
    onDismiss(id);
  };
  const onKeyDown = (id: ToastItem['id']) => (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    dismiss(id);
  };
  return (
    <ol
      ref={list}
      className={classNames('nv-toast-stack', className)}
      aria-label={label}
      aria-live="polite"
      aria-relevant="additions text"
      tabIndex={-1}
    >
      {items.map((item) => (
        <li
          key={item.id}
          role={item.tone === 'error' ? 'alert' : undefined}
          className="nv-shape nv-toast nv-toast-stack__item"
          data-tone={SHAPE_TONE[item.tone]}
          data-duo="magenta"
          data-notice-tone={item.tone}
          data-notice={item.name}
          onKeyDown={onKeyDown(item.id)}
        >
          <span className="nv-toast-stack__icon" aria-hidden="true">
            <Icon name={TONE_ICON[item.tone]} />
          </span>
          <span className="nv-toast-stack__message">{item.message}</span>
          {item.action && (
            <button type="button" className="nv-toast-stack__action" onClick={item.action.onAction}>
              {item.action.label}
            </button>
          )}
          <IconButton
            icon="close"
            label={closeLabel}
            surface="ghost"
            tone="neutral"
            onClick={() => dismiss(item.id)}
          />
        </li>
      ))}
    </ol>
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
