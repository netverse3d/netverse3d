import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import type { ServiceClientRow } from '../repositories/service-client.repository';

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const MAX_LIST_ITEMS = 32;
const MAX_ITEM_LENGTH = 64;
const SERVICE_TOKEN_TYPE = 'Bearer';

export class CreateServiceClientDto {
  @ApiProperty({ example: 'shop', maxLength: 64 })
  @IsString()
  @Length(2, 64)
  @Matches(NAME_PATTERN)
  name: string;

  @ApiProperty({ type: [String], example: ['notification'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LIST_ITEMS)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(MAX_ITEM_LENGTH, { each: true })
  audiences: string[];

  @ApiProperty({ type: [String], example: ['notification:send'] })
  @IsArray()
  @ArrayMaxSize(MAX_LIST_ITEMS)
  @ArrayUnique()
  @Matches(PERMISSION_PATTERN, { each: true })
  @MaxLength(MAX_ITEM_LENGTH, { each: true })
  permissions: string[];
}

export class ServiceClientDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [String] })
  audiences: string[];

  @ApiProperty({ type: [String] })
  permissions: string[];

  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] })
  status: string;

  @ApiProperty({ format: 'date-time' })
  secretRotatedAt: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(row: ServiceClientRow): ServiceClientDto {
    return {
      id: row.id,
      name: row.name,
      audiences: row.audiences,
      permissions: row.permissions,
      status: row.status,
      secretRotatedAt: row.secretRotatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export class CreatedServiceClientDto extends ServiceClientDto {
  @ApiProperty({ description: 'Shown once; store it now' })
  clientSecret: string;
}

export class RotatedSecretDto {
  @ApiProperty({ description: 'Shown once; store it now' })
  clientSecret: string;
}

export class ServiceTokenRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientId: string;

  @ApiProperty()
  @IsString()
  @Length(1, 256)
  clientSecret: string;

  @ApiProperty({ example: 'notification' })
  @IsString()
  @Length(1, MAX_ITEM_LENGTH)
  audience: string;
}

export class ServiceTokenDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: SERVICE_TOKEN_TYPE })
  tokenType: string;

  @ApiProperty({ description: 'Lifetime in seconds' })
  expiresIn: number;

  static of(accessToken: string, expiresIn: number): ServiceTokenDto {
    return { accessToken, tokenType: SERVICE_TOKEN_TYPE, expiresIn };
  }
}
