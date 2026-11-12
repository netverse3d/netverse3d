import { ApiProperty } from '@nestjs/swagger';
import { PaginationQueryDto } from './pagination-query.dto';

export class PageResponseDto<T> {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  content: T[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  size: number;

  @ApiProperty({ example: 42 })
  totalElements: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  static of<T>(content: T[], query: PaginationQueryDto, totalElements: number): PageResponseDto<T> {
    const page = new PageResponseDto<T>();
    page.content = content;
    page.page = query.page;
    page.size = query.size;
    page.totalElements = totalElements;
    page.totalPages = Math.ceil(totalElements / query.size);
    return page;
  }
}
