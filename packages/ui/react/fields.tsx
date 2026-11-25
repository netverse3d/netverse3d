import * as RadioPrimitive from '@radix-ui/react-radio-group';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import {
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './icon.tsx';
import { classNames, splitVariants } from './shared.ts';
import {
  VARIANTS,
  type RadioGroupVariants,
  type SearchFieldVariants,
  type SwitchVariants,
  type TextareaVariants,
  type TextFieldVariants,
} from './variants.generated.ts';

type FieldFrameProps = {
  label: ReactNode;
  labelId?: string;
  message?: ReactNode;
  state?: string;
  className?: string;
  children: ReactNode;
};

function FieldFrame({ label, labelId, message, state, className, children }: FieldFrameProps) {
  return (
    <label
      className={classNames('nv-field', className)}
      data-state={state === 'idle' ? undefined : state}
    >
      <span className="nv-field__label" id={labelId}>
        {label}
      </span>
      <span className="nv-shape nv-input">{children}</span>
      {message && <span className="nv-field__message">{message}</span>}
    </label>
  );
}

export type TextFieldProps = TextFieldVariants &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> & { label: ReactNode; message?: ReactNode };

export function TextField(props: TextFieldProps) {
  const { rest } = splitVariants(props, VARIANTS.TextField);
  const { label, message, className, ...input } = rest as TextFieldProps;
  const state = props.state ?? (input.disabled ? 'disabled' : 'idle');
  return (
    <FieldFrame label={label} message={message} state={state} className={className}>
      <input
        {...input}
        disabled={input.disabled || state === 'disabled'}
        aria-invalid={input['aria-invalid'] ?? (state === 'error' || undefined)}
      />
    </FieldFrame>
  );
}

export type TextareaProps = TextareaVariants &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> & {
    label: ReactNode;
    message?: ReactNode;
  };

export function Textarea(props: TextareaProps) {
  const { rest } = splitVariants(props, VARIANTS.Textarea);
  const { label, message, className, rows = 3, ...textarea } = rest as TextareaProps;
  const state = props.state ?? (textarea.disabled ? 'disabled' : 'idle');
  return (
    <FieldFrame label={label} message={message} state={state} className={className}>
      <textarea
        {...textarea}
        rows={rows}
        disabled={textarea.disabled || state === 'disabled'}
        aria-invalid={textarea['aria-invalid'] ?? (state === 'error' || undefined)}
      />
    </FieldFrame>
  );
}

export type SearchFieldProps = SearchFieldVariants &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'style' | 'type' | 'value' | 'onChange'> & {
    label: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    clearLabel: string;
  };

export function SearchField(props: SearchFieldProps) {
  const { rest } = splitVariants(props, VARIANTS.SearchField);
  const { label, value, onValueChange, clearLabel, className, ...input } = rest as SearchFieldProps;
  const state = props.state ?? (input.disabled ? 'disabled' : 'idle');
  const disabled = input.disabled || state === 'disabled';
  const labelId = useId();
  const field = useRef<HTMLInputElement>(null);
  return (
    <FieldFrame label={label} labelId={labelId} state={state} className={className}>
      <Icon name="search" />
      <input
        {...input}
        ref={field}
        type="search"
        aria-labelledby={input['aria-labelledby'] ?? labelId}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {value && !disabled && (
        <button
          type="button"
          className="nv-field__clear"
          aria-label={clearLabel}
          onClick={() => {
            onValueChange('');
            field.current?.focus();
          }}
        >
          <Icon name="close" />
        </button>
      )}
    </FieldFrame>
  );
}

export type SwitchProps = SwitchVariants &
  Omit<ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, 'style' | 'asChild' | 'children'> & {
    label: ReactNode;
  };

export function Switch(props: SwitchProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Switch);
  const { label, className, ...root } = rest as SwitchProps;
  return (
    <label className={classNames('nv-switch', className)} {...data}>
      <SwitchPrimitive.Root {...root} className="nv-shape nv-switch__track">
        <SwitchPrimitive.Thumb className="nv-switch__thumb" />
      </SwitchPrimitive.Root>
      <span>{label}</span>
    </label>
  );
}

export type RadioOption = { value: string; label: ReactNode; disabled?: boolean };

export type RadioGroupProps = RadioGroupVariants &
  Omit<
    ComponentPropsWithoutRef<typeof RadioPrimitive.Root>,
    'style' | 'asChild' | 'children' | 'orientation'
  > & {
    label: ReactNode;
    options: readonly RadioOption[];
  };

export function RadioGroup(props: RadioGroupProps) {
  const { data, rest } = splitVariants(props, VARIANTS.RadioGroup);
  const { label, options, className, ...root } = rest as RadioGroupProps;
  const labelId = useId();
  return (
    <div className={classNames('nv-radio-group', className)} {...data}>
      <span className="nv-field__label" id={labelId}>
        {label}
      </span>
      <RadioPrimitive.Root
        {...root}
        aria-labelledby={labelId}
        orientation={props.direction === 'row' ? 'horizontal' : 'vertical'}
        className="nv-radio-group__items"
      >
        {options.map((option) => (
          <label key={option.value} className="nv-radio-group__item">
            <RadioPrimitive.Item
              value={option.value}
              disabled={option.disabled}
              className="nv-shape nv-radio-group__box"
              data-shape="bevel-all"
            >
              <RadioPrimitive.Indicator className="nv-radio-group__dot" />
            </RadioPrimitive.Item>
            {option.label}
          </label>
        ))}
      </RadioPrimitive.Root>
    </div>
  );
}
