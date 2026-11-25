import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { buttonInteraction } from '../src/interaction.mjs';
import { Icon, type IconName } from './icon.tsx';
import { classNames, splitVariants } from './shared.ts';
import {
  VARIANTS,
  type ActionButtonVariants,
  type ButtonVariants,
  type IconButtonVariants,
  type KeyHintVariants,
} from './variants.generated.ts';

type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'>;

export function Spinner() {
  return <span className="nv-spinner" aria-hidden="true" />;
}

export type ButtonProps = ButtonVariants & NativeButton & { block?: boolean };

export function Button(props: ButtonProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Button, {
    surface: 'filled',
    duo: 'magenta',
  });
  const { block, className, children, disabled, type = 'button', ...native } = rest as ButtonProps;
  const interaction = buttonInteraction(props.state ?? 'idle', disabled);
  return (
    <button
      {...native}
      type={type}
      className={classNames('nv-shape nv-button', className)}
      {...data}
      data-block={block ? '' : undefined}
      disabled={interaction.disabled}
      aria-busy={interaction.busy || undefined}
    >
      {interaction.spinner && <Spinner />}
      {children}
    </button>
  );
}

export type IconButtonProps = IconButtonVariants &
  Omit<NativeButton, 'children' | 'aria-label'> & { icon: IconName; label: string };

export function IconButton(props: IconButtonProps) {
  const { data, rest } = splitVariants(props, VARIANTS.IconButton, {
    tone: 'cyan',
    surface: 'neon',
  });
  const { icon, label, className, type = 'button', ...native } = rest as IconButtonProps;
  return (
    <button
      {...native}
      type={type}
      aria-label={label}
      className={classNames('nv-shape nv-icon-button', className)}
      {...data}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Keycap({ children }: { children: ReactNode }) {
  return <kbd className="nv-keycap">{children}</kbd>;
}

export type KeyHintProps = KeyHintVariants &
  Omit<HTMLAttributes<HTMLSpanElement>, 'style'> & { keyLabel: string };

export function KeyHint(props: KeyHintProps) {
  const { data, rest } = splitVariants(props, VARIANTS.KeyHint, { duo: 'cyan' });
  const { keyLabel, className, children, ...native } = rest as KeyHintProps;
  return (
    <span {...native} className={classNames('nv-shape nv-key-hint', className)} {...data}>
      <Keycap>{keyLabel}</Keycap>
      {children}
    </span>
  );
}

export type ActionButtonProps = ActionButtonVariants &
  Omit<NativeButton, 'children'> & { icon: IconName; label: string; keyLabel: string };

export function ActionButton({ icon, label, keyLabel, className, ...native }: ActionButtonProps) {
  return (
    <span className={classNames('nv-action', className)}>
      <IconButton {...native} icon={icon} label={label} shape="hex" duo="magenta" />
      <span aria-hidden="true">{label}</span>
      <Keycap>{keyLabel}</Keycap>
    </span>
  );
}
