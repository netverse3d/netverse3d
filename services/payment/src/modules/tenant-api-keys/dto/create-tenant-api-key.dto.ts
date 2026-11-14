import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateTenantApiKeyDto {
  @ApiProperty()
  @IsString()
  @Length(2, 120)
  label!: string;
}
