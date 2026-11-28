import * as RadioPrimitive from '@radix-ui/react-radio-group';
import * as SliderPrimitive from '@radix-ui/react-slider';
import {
  useId,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { chooseItem, rowNeighbor, stepNumber } from '../src/pickers.mjs';
import { Icon, type IconName } from './icon.tsx';
import { classNames, splitVariants, useRememberedValue } from './shared.ts';
import { VARIANTS, type ItemGridVariants } from './variants.generated.ts';

type NativeDiv = Omit<
  HTMLAttributes<HTMLDivElement>,
  'style' | 'defaultValue' | 'onChange' | 'dir' | 'children'
>;

const ROW_KEYS: Record<string, -1 | 1> = { ArrowUp: -1, ArrowDown: 1 };

function moveAcrossRows(event: KeyboardEvent<HTMLButtonElement>): HTMLElement | undefined {
  const direction = ROW_KEYS[event.key];
  const grid = event.currentTarget.parentElement;
  if (!direction || !grid) return undefined;
  const cells = [...grid.children] as HTMLElement[];
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const index = cells.indexOf(event.currentTarget);
  event.preventDefault();
  const target = cells[rowNeighbor(index, cells.length, columns, direction)];
  target?.focus();
  return target;
}

type Choice = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

function useChoice(
  { value, defaultValue, onValueChange }: Choice,
  accept: (candidate: string | undefined) => string,
) {
  const [chosen, remember] = useRememberedValue(value, defaultValue);
  const current = accept(chosen);
  const choose = (next: string) => {
    if (next === current) return;
    remember(next);
    onValueChange?.(next);
  };
  return [current, choose] as const;
}

export type SwatchOption = { value: string; color: string; label: string };

export type ColorSwatchProps = NativeDiv &
  Choice & {
    label: ReactNode;
    options: readonly SwatchOption[];
  };

export function ColorSwatch({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  className,
  ...native
}: ColorSwatchProps) {
  const labelId = useId();
  const [current, choose] = useChoice({ value, defaultValue, onValueChange }, (candidate) =>
    options.some((option) => option.value === candidate)
      ? (candidate as string)
      : (options[0]?.value ?? ''),
  );
  return (
    <div {...native} className={classNames('nv-swatches', className)}>
      <span className="nv-field__label" id={labelId}>
        {label}
      </span>
      <RadioPrimitive.Root
        className="nv-swatches__items"
        aria-labelledby={labelId}
        orientation="horizontal"
        value={current}
        onValueChange={choose}
        loop
      >
        {options.map((option) => (
          <RadioPrimitive.Item
            key={option.value}
            value={option.value}
            aria-label={option.label}
            className="nv-swatches__item"
            style={{ '--nv-swatch': option.color } as CSSProperties}
          >
            <span className="nv-swatches__chip">
              <RadioPrimitive.Indicator className="nv-swatches__check">
                <Icon name="check" />
              </RadioPrimitive.Indicator>
            </span>
          </RadioPrimitive.Item>
        ))}
      </RadioPrimitive.Root>
    </div>
  );
}

export type GridItem = {
  id: string;
  label: string;
  icon?: IconName;
  preview?: ReactNode;
  locked?: boolean;
};

export type ItemGridProps = ItemGridVariants &
  NativeDiv &
  Choice & {
    label: ReactNode;
    items: readonly GridItem[];
    lockedLabel: string;
  };

export function ItemGrid(props: ItemGridProps) {
  const { data, rest } = splitVariants(props, VARIANTS.ItemGrid, { size: 'md' });
  const { label, items, lockedLabel, value, defaultValue, onValueChange, className, ...native } =
    rest as ItemGridProps;
  const labelId = useId();
  const firstOpen = items.find((item) => !item.locked)?.id ?? '';
  const [current, choose] = useChoice({ value, defaultValue, onValueChange }, (candidate) =>
    chooseItem(items, firstOpen, candidate),
  );
  return (
    <div {...native} className={classNames('nv-item-grid', className)} {...data}>
      <span className="nv-field__label" id={labelId}>
        {label}
      </span>
      <RadioPrimitive.Root
        className="nv-item-grid__items"
        aria-labelledby={labelId}
        value={current}
        onValueChange={(next) => choose(chooseItem(items, current, next))}
        loop
      >
        {items.map((item) => (
          <RadioPrimitive.Item
            key={item.id}
            value={item.id}
            aria-disabled={item.locked || undefined}
            aria-label={item.locked ? `${item.label}, ${lockedLabel}` : item.label}
            className="nv-shape nv-item-grid__item"
            data-shape="bevel-all"
            data-cut="sm"
            data-locked={item.locked ? '' : undefined}
            data-item={item.id}
            onKeyDown={(event) => {
              const target = moveAcrossRows(event)?.dataset.item;
              if (target) choose(chooseItem(items, current, target));
            }}
          >
            <span className="nv-item-grid__media" aria-hidden="true">
              {item.preview ?? (item.icon && <Icon name={item.icon} />)}
            </span>
            <span className="nv-item-grid__name" aria-hidden="true">
              {item.label}
            </span>
            {item.locked ? (
              <span className="nv-item-grid__lock" aria-hidden="true">
                <Icon name="lock" />
              </span>
            ) : (
              <RadioPrimitive.Indicator className="nv-item-grid__check">
                <Icon name="check" />
              </RadioPrimitive.Indicator>
            )}
          </RadioPrimitive.Item>
        ))}
      </RadioPrimitive.Root>
    </div>
  );
}

type NumberChoice = {
  min: number;
  max: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
};

function useNumber({ value, defaultValue, onValueChange, min, max, step = 1 }: NumberChoice) {
  const limits = { min, max, step };
  const [chosen, remember] = useRememberedValue(value, defaultValue ?? min);
  const current = stepNumber(chosen, 0, limits);
  const choose = (next: number) => {
    const settled = stepNumber(next, 0, limits);
    if (settled === current) return;
    remember(settled);
    onValueChange?.(settled);
  };
  return [current, choose, limits] as const;
}

export type SliderProps = NativeDiv &
  NumberChoice & {
    label: ReactNode;
    valueText?: (value: number) => string;
    disabled?: boolean;
  };

export function Slider({
  label,
  valueText,
  disabled,
  min,
  max,
  step,
  value,
  defaultValue,
  onValueChange,
  className,
  ...native
}: SliderProps) {
  const labelId = useId();
  const [current, choose, limits] = useNumber({
    min,
    max,
    step,
    value,
    defaultValue,
    onValueChange,
  });
  const shown = valueText ? valueText(current) : String(current);
  return (
    <div {...native} className={classNames('nv-slider', className)}>
      <div className="nv-slider__head">
        <span className="nv-field__label" id={labelId}>
          {label}
        </span>
        <span className="nv-slider__value" aria-hidden="true">
          {shown}
        </span>
      </div>
      <SliderPrimitive.Root
        className="nv-slider__root"
        value={[current]}
        min={limits.min}
        max={limits.max}
        step={limits.step}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next !== undefined) choose(next);
        }}
      >
        <SliderPrimitive.Track className="nv-slider__track">
          <SliderPrimitive.Range className="nv-slider__range" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="nv-slider__thumb"
          aria-labelledby={labelId}
          aria-valuetext={shown}
        />
      </SliderPrimitive.Root>
    </div>
  );
}

export type NumberStepperProps = NativeDiv &
  NumberChoice & {
    label: ReactNode;
    decreaseLabel: string;
    increaseLabel: string;
    disabled?: boolean;
  };

export function NumberStepper({
  label,
  decreaseLabel,
  increaseLabel,
  disabled,
  min,
  max,
  step,
  value,
  defaultValue,
  onValueChange,
  className,
  ...native
}: NumberStepperProps) {
  const inputId = useId();
  const [current, choose, limits] = useNumber({
    min,
    max,
    step,
    value,
    defaultValue,
    onValueChange,
  });
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft !== null && draft.trim() !== '') choose(Number(draft));
    setDraft(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') settle();
    if (event.key === 'Escape' && draft !== null) {
      event.preventDefault();
      setDraft(null);
    }
  };
  return (
    <div {...native} className={classNames('nv-stepper', className)}>
      <label className="nv-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="nv-shape nv-stepper__control" data-shape="bevel-all" data-cut="sm">
        <button
          type="button"
          className="nv-stepper__button"
          aria-label={decreaseLabel}
          aria-controls={inputId}
          disabled={disabled}
          aria-disabled={current <= limits.min || undefined}
          onClick={() => choose(stepNumber(current, -1, limits))}
        >
          <Icon name="minus" />
        </button>
        <input
          id={inputId}
          className="nv-stepper__input"
          type="number"
          inputMode="decimal"
          min={limits.min}
          max={limits.max}
          step={limits.step}
          value={draft ?? String(current)}
          disabled={disabled}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={settle}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="nv-stepper__button"
          aria-label={increaseLabel}
          aria-controls={inputId}
          disabled={disabled}
          aria-disabled={current >= limits.max || undefined}
          onClick={() => choose(stepNumber(current, 1, limits))}
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
