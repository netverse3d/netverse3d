import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';

export type SortDirection = 'asc' | 'desc';

export function resolveSort<Field extends string>(
  sort: string | undefined,
  allowedFields: readonly Field[],
  fallback: Partial<Record<Field, SortDirection>>,
): Partial<Record<Field, SortDirection>> {
  if (!sort) {
    return fallback;
  }
  const [field, direction] = sort.split(',') as [Field, SortDirection];
  if (!allowedFields.includes(field)) {
    throw new AppException(ErrorCode.VALIDATION, {
      details: [
        { field: 'sort', errors: [`sort field must be one of: ${allowedFields.join(', ')}`] },
      ],
    });
  }
  return { [field]: direction } as Partial<Record<Field, SortDirection>>;
}
