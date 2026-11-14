import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

export class ConfirmTransferDto {
  @ApiProperty({ example: 49000 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;

  @ApiProperty({ example: 'VND' })
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency!: string;

  @ApiProperty({ example: 'FT26291123456' })
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  bankReference!: string;

  @ApiProperty({ example: 'admin:user-123' })
  @IsString()
  @Length(1, 120)
  operatorRef!: string;
}
