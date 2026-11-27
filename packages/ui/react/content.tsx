import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Meter } from './feedback.tsx';
import { classNames, splitVariants } from './shared.ts';
import {
  VARIANTS,
  type HeadingVariants,
  type PlayerBadgeVariants,
  type TextVariants,
} from './variants.generated.ts';

export type HeadingProps = HeadingVariants & Omit<HTMLAttributes<HTMLHeadingElement>, 'style'>;

export function Heading(props: HeadingProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Heading);
  const { className, children, ...native } = rest as HeadingProps;
  const Tag = `h${props.level ?? '2'}` as 'h1' | 'h2' | 'h3';
  return (
    <Tag {...native} className={classNames('nv-heading', className)} {...data}>
      {children}
    </Tag>
  );
}

export type TextProps = TextVariants &
  Omit<HTMLAttributes<HTMLElement>, 'style'> & { as?: 'p' | 'span' | 'strong' | 'time' };

export function Text(props: TextProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Text);
  const { as: Tag = 'p', className, children, ...native } = rest as TextProps;
  return (
    <Tag {...native} className={classNames('nv-text', className)} {...data}>
      {children}
    </Tag>
  );
}

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'style' | 'type'> & {
  label: ReactNode;
  meta?: ReactNode;
};

export function Checkbox({ label, meta, className, ...input }: CheckboxProps) {
  return (
    <label className={classNames('nv-check', className)}>
      <input {...input} type="checkbox" />
      <span className="nv-shape nv-check__box">
        <span className="nv-check__mark" />
      </span>
      {label}
      {meta && <span className="nv-check__meta">{meta}</span>}
    </label>
  );
}

export function Avatar({ label }: { label: string }) {
  return <span className="nv-avatar" role="img" aria-label={label} />;
}

export type PlayerBadgeProps = PlayerBadgeVariants & {
  name: string;
  level: ReactNode;
  progress: number;
  progressLabel: string;
  className?: string;
};

export function PlayerBadge(props: PlayerBadgeProps) {
  const { data, rest } = splitVariants(props, VARIANTS.PlayerBadge, {
    shape: 'notch',
    tone: 'magenta',
    duo: 'cyan',
    cut: 'sm',
  });
  const { name, level, progress, progressLabel, className } = rest as PlayerBadgeProps;
  return (
    <div className={classNames('nv-shape nv-panel nv-profile', className)} {...data}>
      <div className="nv-profile__row">
        <Avatar label={name} />
        <div className="nv-profile__text">
          <strong>{name}</strong>
          <span className="nv-panel__meta">{level}</span>
          <Meter value={progress} label={progressLabel} />
        </div>
      </div>
    </div>
  );
}
