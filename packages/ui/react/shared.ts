import { useState } from 'react';
import { variantData } from '../src/variants.mjs';

export type VariantOptions = Readonly<Record<string, readonly string[]>>;

export function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

export function splitVariants<P extends object>(
  props: P,
  options: VariantOptions,
  defaults: Partial<Record<string, string>> = {},
): { data: Record<string, string>; rest: Omit<P, keyof typeof options> } {
  const chosen: Record<string, string | undefined> = { ...defaults };
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (Object.hasOwn(options, key)) {
      if (value !== undefined) chosen[key] = value as string;
    } else {
      rest[key] = value;
    }
  }
  return {
    data: variantData(chosen, options) as Record<string, string>,
    rest: rest as Omit<P, keyof typeof options>,
  };
}

export function useRememberedValue<T>(value: T | undefined, initial: T) {
  const [remembered, setRemembered] = useState<T>(value ?? initial);
  if (value !== undefined && !Object.is(value, remembered)) setRemembered(value);
  return [value ?? remembered, setRemembered] as const;
}
