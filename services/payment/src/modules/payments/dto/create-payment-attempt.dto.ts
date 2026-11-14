import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIP, IsOptional, IsString, Length } from 'class-validator';

export class CreatePaymentAttemptDto {
  @ApiProperty()
  @IsString()
  @Length(1, 40)
  providerCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  returnUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  cancelUrl?: string;

  @ApiPropertyOptional({
    description: 'Payer IP address, taken by the tenant from the real request',
  })
  @IsOptional()
  @IsIP()
  clientIp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  userAgent?: string;

  @ApiPropertyOptional({ example: 'vi' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  locale?: string;
}
