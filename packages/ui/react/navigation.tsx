import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import {
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { pageSteps } from '../src/pagination.mjs';
import { Button } from './actions.tsx';
import { Icon } from './icon.tsx';
import { classNames, splitVariants } from './shared.ts';
import { VARIANTS, type TextLinkVariants } from './variants.generated.ts';

export type TabItem = { value: string; label: ReactNode; content: ReactNode; disabled?: boolean };

export type TabsProps = {
  label: string;
  items: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

export function Tabs({ label, items, className, ...selection }: TabsProps) {
  return (
    <TabsPrimitive.Root
      {...selection}
      defaultValue={selection.defaultValue ?? items[0]?.value}
      className={classNames('nv-tabs', className)}
    >
      <TabsPrimitive.List className="nv-tabs__list" aria-label={label} loop>
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className="nv-tabs__tab"
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value} className="nv-tabs__panel">
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

export type SegmentOption = { value: string; label: ReactNode; disabled?: boolean };

export type SegmentedControlProps = {
  label: string;
  options: readonly SegmentOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function SegmentedControl({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
}: SegmentedControlProps) {
  const [chosen, setChosen] = useState(defaultValue ?? options[0]?.value ?? '');
  const current = value ?? chosen;
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      aria-label={label}
      value={current}
      onValueChange={(next) => {
        if (!next) return;
        setChosen(next);
        onValueChange?.(next);
      }}
      disabled={disabled}
      loop
      className={classNames('nv-segmented', className)}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="nv-segmented__item"
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

export type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
  previousLabel: string;
  nextLabel: string;
  pageLabel: (page: number, totalPages: number) => string;
  disabled?: boolean;
  className?: string;
};

type PageStep = 'previous' | 'next';

export function Pagination({
  page,
  totalPages,
  onPageChange,
  label,
  previousLabel,
  nextLabel,
  pageLabel,
  disabled = false,
  className,
}: PaginationProps) {
  const { previous, next } = pageSteps(page, totalPages);
  const nav = useRef<HTMLElement>(null);
  const refocus = useRef<PageStep | null>(null);
  useEffect(() => {
    const step = refocus.current;
    refocus.current = null;
    if (step) nav.current?.querySelector<HTMLElement>(`[data-page-step="${step}"]`)?.focus();
  }, [page]);
  const go = (target: number, step: PageStep) => {
    if (pageSteps(target, totalPages)[step] === null)
      refocus.current = step === 'next' ? 'previous' : 'next';
    onPageChange(target);
  };
  return (
    <nav ref={nav} className={classNames('nv-pagination', className)} aria-label={label}>
      <Button
        size="sm"
        surface="glass"
        tone="neutral"
        state={previous === null || disabled ? 'disabled' : 'idle'}
        onClick={() => {
          if (previous !== null) go(previous, 'previous');
        }}
        data-page-step="previous"
      >
        <Icon name="chevronLeft" />
        {previousLabel}
      </Button>
      <span className="nv-pagination__current" aria-live="polite">
        {pageLabel(page, totalPages)}
      </span>
      <Button
        size="sm"
        surface="glass"
        tone="neutral"
        state={next === null || disabled ? 'disabled' : 'idle'}
        onClick={() => {
          if (next !== null) go(next, 'next');
        }}
        data-page-step="next"
      >
        {nextLabel}
        <Icon name="chevron" />
      </Button>
    </nav>
  );
}

type LinkStyle = TextLinkVariants & { className?: string };

export type TextLinkProps =
  | (LinkStyle & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'style'> & { href: string })
  | (LinkStyle & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> & { href?: undefined });

export function TextLink(props: TextLinkProps) {
  const { data, rest } = splitVariants(props, VARIANTS.TextLink, { tone: 'cyan' });
  const { className, ...native } = rest as TextLinkProps;
  const classes = classNames('nv-link', className);
  if (native.href !== undefined) {
    return (
      <a {...(native as AnchorHTMLAttributes<HTMLAnchorElement>)} className={classes} {...data} />
    );
  }
  return (
    <button
      type="button"
      {...(native as ButtonHTMLAttributes<HTMLButtonElement>)}
      className={classes}
      {...data}
    />
  );
}
