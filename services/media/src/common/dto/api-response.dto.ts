import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SUCCESS_CODE = 'SUCCESS';

export class ApiResponseDto<T> {
  @ApiProperty({ example: SUCCESS_CODE })
  code: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  message: string | null;

  @ApiProperty({ type: Object, nullable: true })
  result: T | null;

  @ApiProperty({ type: String, nullable: true })
  requestId: string | null;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 'COMMON.VALIDATION' })
  code: string;

  @ApiProperty({ example: 'Request validation failed' })
  message: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  details?: unknown;

  @ApiProperty({ example: '/v1/examples' })
  path: string;

  @ApiProperty({ format: 'date-time' })
  timestamp: string;

  @ApiProperty({ type: String, nullable: true })
  requestId: string | null;
}
