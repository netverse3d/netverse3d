import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import type { HTMLAttributes, ReactNode } from 'react';
import { PROGRESS_MAX, progressValue } from '../src/progress.mjs';
import { Icon, type IconName } from './icon.tsx';
import { classNames, splitVariants } from './shared.ts';
import {
  VARIANTS,
  type ChipVariants,
  type DividerVariants,
  type ProgressBarVariants,
  type SkeletonVariants,
} from './variants.generated.ts';

type NativeSpan = Omit<HTMLAttributes<HTMLSpanElement>, 'style'>;

export type ChipProps = ChipVariants &
  NativeSpan & {
    icon?: IconName;
    onRemove?: () => void;
    removeLabel?: string;
  };

export function Chip(props: ChipProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Chip, { tone: 'neutral' });
  const { icon, onRemove, removeLabel, className, children, ...native } = rest as ChipProps;
  return (
    <span {...native} className={classNames('nv-chip', className)} {...data}>
      {icon && <Icon name={icon} />}
      <span className="nv-chip__label">{children}</span>
      {onRemove && removeLabel && (
        <button
          type="button"
          className="nv-chip__remove"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <Icon name="close" />
        </button>
      )}
    </span>
  );
}

export type SkeletonProps = SkeletonVariants & Omit<NativeSpan, 'children'>;

export function Skeleton(props: SkeletonProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Skeleton, { variant: 'line' });
  const { className, ...native } = rest as SkeletonProps;
  return (
    <span
      {...native}
      aria-hidden="true"
      className={classNames('nv-skeleton', className)}
      {...data}
    />
  );
}

export type ProgressBarProps = ProgressBarVariants &
  Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'children'> & {
    label: string;
    value?: number | null;
    valueText?: string;
  };

export function ProgressBar(props: ProgressBarProps) {
  const { data, rest } = splitVariants(props, VARIANTS.ProgressBar, { tone: 'accent' });
  const { label, value, valueText, className, ...native } = rest as ProgressBarProps;
  const current = progressValue(value);
  return (
    <ProgressPrimitive.Root
      {...native}
      value={current}
      max={PROGRESS_MAX}
      aria-label={label}
      aria-valuetext={valueText}
      className={classNames('nv-progress', className)}
      {...data}
    >
      <ProgressPrimitive.Indicator
        className="nv-progress__fill"
        style={
          current === null ? undefined : { transform: `translateX(${current - PROGRESS_MAX}%)` }
        }
      />
    </ProgressPrimitive.Root>
  );
}

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'title'> & {
  icon: IconName;
  title: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
  ...native
}: EmptyStateProps) {
  return (
    <div {...native} className={classNames('nv-empty', className)}>
      <span
        className="nv-shape nv-empty__icon"
        data-shape="hex"
        data-tone="cyan"
        data-surface="neon"
      >
        <Icon name={icon} />
      </span>
      <p className="nv-empty__title">{title}</p>
      {message && <p className="nv-empty__message">{message}</p>}
      {action && <div className="nv-empty__action">{action}</div>}
    </div>
  );
}

export type DividerProps = DividerVariants &
  Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'children'> & { decorative?: boolean };

export function Divider(props: DividerProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Divider, { orientation: 'horizontal' });
  const { decorative = true, className, ...native } = rest as DividerProps;
  return (
    <SeparatorPrimitive.Root
      {...native}
      decorative={decorative}
      orientation={props.orientation ?? 'horizontal'}
      className={classNames('nv-divider', className)}
      {...data}
    />
  );
}
