import * as SelectPrimitive from '@radix-ui/react-select';
import { useCallback, useId, useState, type HTMLAttributes, type ReactNode } from 'react';
import { Icon } from './icon.tsx';
import { classNames, splitVariants } from './shared.ts';
import { VARIANTS, type SelectVariants } from './variants.generated.ts';

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean };

export type SelectProps = SelectVariants &
  Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'defaultValue' | 'dir' | 'onChange'> & {
    label: ReactNode;
    options: readonly SelectOption[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    placeholder?: ReactNode;
    disabled?: boolean;
    name?: string;
    returnFocus?: boolean;
  };

export function Select(props: SelectProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Select);
  const {
    label,
    options,
    value,
    defaultValue,
    onValueChange,
    placeholder,
    disabled,
    name,
    returnFocus = true,
    className,
    ...native
  } = rest as SelectProps;
  const state = props.state ?? (disabled ? 'disabled' : 'idle');
  const labelId = useId();
  const triggerId = useId();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const findContainer = useCallback((node: HTMLDivElement | null) => {
    setContainer(node?.closest('dialog') ?? null);
  }, []);
  return (
    <div
      {...native}
      ref={findContainer}
      className={classNames('nv-field nv-select', className)}
      {...data}
      data-state={state === 'idle' ? undefined : state}
    >
      <span className="nv-field__label" id={labelId}>
        {label}
      </span>
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={state === 'disabled'}
        name={name}
      >
        <SelectPrimitive.Trigger
          id={triggerId}
          aria-labelledby={`${labelId} ${triggerId}`}
          className="nv-shape nv-input nv-select__trigger"
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="nv-select__icon">
            <Icon name="chevronDown" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal container={container ?? undefined}>
          <SelectPrimitive.Content
            className="nv-shape nv-select__content"
            position="popper"
            sideOffset={6}
            onCloseAutoFocus={(event) => {
              if (!returnFocus) event.preventDefault();
            }}
          >
            <SelectPrimitive.Viewport className="nv-select__viewport">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="nv-select__item"
                  data-value={option.value}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="nv-select__check">
                    <Icon name="check" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
