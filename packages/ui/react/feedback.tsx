import type { HTMLAttributes, ReactNode } from 'react';
import { classNames, splitVariants } from './shared.ts';
import {
  VARIANTS,
  type AlertVariants,
  type BadgeVariants,
  type StatusVariants,
  type ToastVariants,
} from './variants.generated.ts';

type NativeSpan = Omit<HTMLAttributes<HTMLSpanElement>, 'style'>;

export type AlertProps = AlertVariants & Omit<HTMLAttributes<HTMLParagraphElement>, 'style'>;

export function Alert(props: AlertProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Alert);
  const { className, children, role, ...native } = rest as AlertProps;
  const tone = props.tone ?? 'error';
  return (
    <p
      {...native}
      role={role ?? (tone === 'error' || tone === 'warning' ? 'alert' : 'status')}
      className={classNames('nv-alert', className)}
      {...data}
    >
      {children}
    </p>
  );
}

export type ToastProps = ToastVariants & Omit<HTMLAttributes<HTMLDivElement>, 'style'>;

export function Toast(props: ToastProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Toast, { tone: 'cyan', duo: 'magenta' });
  const { className, children, ...native } = rest as ToastProps;
  return (
    <div role="status" {...native} className={classNames('nv-shape nv-toast', className)} {...data}>
      {children}
    </div>
  );
}

export type BadgeProps = BadgeVariants & NativeSpan;

export function Badge(props: BadgeProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Badge);
  const { className, children, ...native } = rest as BadgeProps;
  return (
    <span {...native} className={classNames('nv-badge', className)} {...data}>
      {children}
    </span>
  );
}

export type StatusProps = StatusVariants & NativeSpan & { children: ReactNode };

export function Status(props: StatusProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Status);
  const { className, children, ...native } = rest as StatusProps;
  return (
    <span {...native} className={classNames('nv-status', className)} {...data}>
      {children}
    </span>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      className="nv-meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="nv-meter__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export type OverlayProps = Omit<HTMLAttributes<HTMLDivElement>, 'style'>;

export function Overlay({ className, children, ...native }: OverlayProps) {
  return (
    <div {...native} className={classNames('nv-scrim', className)}>
      {children}
    </div>
  );
}
