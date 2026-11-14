import { SortDirection } from './resolve-sort';

export type ColumnSort = Record<string, SortDirection>;

export function toColumnSort(sort: Partial<Record<string, SortDirection>>): ColumnSort {
  return Object.fromEntries(
    Object.entries(sort).map(([field, direction]) => [
      field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      direction as SortDirection,
    ]),
  );
}
