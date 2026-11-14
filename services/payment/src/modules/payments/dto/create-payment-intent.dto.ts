import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateCustomerDto } from '@app/modules/customers/dto/create-customer.dto';

export class CreatePaymentIntentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer?: CreateCustomerDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  merchantReference?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  targetType!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  targetRef!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  @IsObject()
  targetSnapshot!: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'VND' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  subtotalMinor!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  discountMinor?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  feeMinor?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  taxMinor?: number;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
