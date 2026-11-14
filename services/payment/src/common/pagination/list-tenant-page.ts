import { PageResponseDto } from './page-response.dto';
import { PaginationQueryDto } from './pagination-query.dto';
import { resolveSort, SortDirection } from './resolve-sort';
import { toColumnSort } from './to-column-sort';

export function listTenantPage<Row, View, Field extends string>(
  tenantId: string,
  query: PaginationQueryDto,
  sortableFields: readonly Field[],
  defaultSort: Partial<Record<Field, SortDirection>>,
  findPage: (
    tenantId: string,
    orderBy: Record<string, SortDirection>,
    skip: number,
    take: number,
  ) => Promise<[Row[], number]>,
  toView: (row: Row) => View,
): Promise<PageResponseDto<View>> {
  const orderBy = toColumnSort(resolveSort(query.sort, sortableFields, defaultSort));
  return findPage(tenantId, orderBy, query.skip, query.take).then(([rows, total]) =>
    PageResponseDto.of(rows.map(toView), query, total),
  );
}
