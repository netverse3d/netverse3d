import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  size: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ example: 'createdAt,desc' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9]*,(asc|desc)$/, {
    message: 'sort must look like field,asc or field,desc',
  })
  sort?: string;

  get skip(): number {
    return (this.page - 1) * this.size;
  }

  get take(): number {
    return this.size;
  }
}
