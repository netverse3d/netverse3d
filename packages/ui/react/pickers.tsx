import * as RadioPrimitive from '@radix-ui/react-radio-group';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { chooseItem, stepNumber } from '../src/pickers.mjs';
import { Icon, type IconName } from './icon.tsx';
import { classNames, splitVariants } from './shared.ts';
import { VARIANTS, type ItemGridVariants } from './variants.generated.ts';

type Choice = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

function useChoice({ value, defaultValue, onValueChange }: Choice, fallback: string) {
  const [chosen, setChosen] = useState(defaultValue ?? fallback);
  const current = value ?? chosen;
  const choose = (next: string) => {
    if (next === current) return;
    setChosen(next);
    onValueChange?.(next);
  };
  return [current, choose] as const;
}

export type SwatchOption = { value: string; color: string; label: string };

export type ColorSwatchProps = Choice & {
  label: ReactNode;
  options: readonly SwatchOption[];
  className?: string;
};

export function ColorSwatch({ label, options, className, ...choice }: ColorSwatchProps) {
  const labelId = useId();
  const [current, choose] = useChoice(choice, options[0]?.value ?? '');
  return (
    <div className={classNames('nv-swatches', className)}>
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
            <RadioPrimitive.Indicator className="nv-swatches__check">
              <Icon name="check" />
            </RadioPrimitive.Indicator>
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
  Choice & {
    label: ReactNode;
    items: readonly GridItem[];
    lockedLabel: string;
    className?: string;
  };

export function ItemGrid(props: ItemGridProps) {
  const { data, rest } = splitVariants(props, VARIANTS.ItemGrid, { size: 'md' });
  const { label, items, lockedLabel, className, ...choice } = rest as ItemGridProps;
  const labelId = useId();
  const firstOpen = items.find((item) => !item.locked)?.id ?? '';
  const [current, choose] = useChoice(choice, firstOpen);
  return (
    <div className={classNames('nv-item-grid', className)} {...data}>
      <span className="nv-field__label" id={labelId}>
        {label}
      </span>
      <RadioPrimitive.Root
        className="nv-item-grid__items"
        aria-labelledby={labelId}
        value={current}
        onValueChange={(next) => choose(chooseItem(items, current, next) ?? current)}
        loop
      >
        {items.map((item) => (
          <RadioPrimitive.Item
            key={item.id}
            value={item.id}
            disabled={item.locked}
            aria-label={item.locked ? `${item.label}, ${lockedLabel}` : item.label}
            className="nv-shape nv-item-grid__item"
            data-shape="bevel-all"
            data-cut="sm"
            data-locked={item.locked ? '' : undefined}
            data-item={item.id}
          >
            <span className="nv-item-grid__media" aria-hidden="true">
              {item.preview ?? (item.icon && <Icon name={item.icon} />)}
            </span>
            <span className="nv-item-grid__name" aria-hidden="true">
              {item.label}
            </span>
            {item.locked && (
              <span className="nv-item-grid__lock" aria-hidden="true">
                <Icon name="lock" />
              </span>
            )}
            <RadioPrimitive.Indicator className="nv-item-grid__check">
              <Icon name="check" />
            </RadioPrimitive.Indicator>
          </RadioPrimitive.Item>
        ))}
      </RadioPrimitive.Root>
    </div>
  );
}

type NumberRange = { min: number; max: number; step?: number };

type NumberChoice = NumberRange & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
};

function useNumber({ value, defaultValue, onValueChange, min }: NumberChoice) {
  const [chosen, setChosen] = useState(defaultValue ?? min);
  const current = value ?? chosen;
  const choose = (next: number) => {
    if (next === current) return;
    setChosen(next);
    onValueChange?.(next);
  };
  return [current, choose] as const;
}

export type SliderProps = NumberChoice & {
  label: ReactNode;
  valueText?: (value: number) => string;
  disabled?: boolean;
  className?: string;
};

export function Slider({ label, valueText, disabled, className, ...range }: SliderProps) {
  const labelId = useId();
  const [current, choose] = useNumber(range);
  const shown = valueText ? valueText(current) : String(current);
  return (
    <div className={classNames('nv-slider', className)}>
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
        min={range.min}
        max={range.max}
        step={range.step ?? 1}
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

export type NumberStepperProps = NumberChoice & {
  label: ReactNode;
  decreaseLabel: string;
  increaseLabel: string;
  disabled?: boolean;
  className?: string;
};

export function NumberStepper({
  label,
  decreaseLabel,
  increaseLabel,
  disabled,
  className,
  ...range
}: NumberStepperProps) {
  const inputId = useId();
  const [current, choose] = useNumber(range);
  const limits = { min: range.min, max: range.max, step: range.step ?? 1 };
  return (
    <div className={classNames('nv-stepper', className)}>
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
          inputMode="numeric"
          min={limits.min}
          max={limits.max}
          step={limits.step}
          value={current}
          disabled={disabled}
          onChange={(event) => {
            const typed = event.currentTarget.valueAsNumber;
            if (Number.isFinite(typed)) choose(stepNumber(typed, 0, limits));
          }}
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
