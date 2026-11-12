import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

export class CreateTenantDto {
  @ApiProperty({ example: 'acme', maxLength: 64 })
  @IsString()
  @Length(2, 64)
  @Matches(NAME_PATTERN)
  slug: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'SUSPENDED';
}

export class TenantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  status: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class UpsertRoleDto {
  @ApiProperty({ example: 'editor', maxLength: 64 })
  @IsString()
  @Length(2, 64)
  @Matches(NAME_PATTERN)
  name: string;

  @ApiPropertyOptional({ type: [String], example: ['media:write'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  permissions: string[] = [];
}

export class RoleDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [String] })
  permissions: string[];
}

export class RoleListDto {
  @ApiProperty({ type: [RoleDto] })
  roles: RoleDto[];
}

export class AddMemberDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  roles: string[] = [];
}

export class SetMemberRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  roles: string[];
}

export class MemberDto {
  @ApiProperty({ format: 'uuid' })
  principalId: string;

  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty({ type: String, nullable: true })
  displayName: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] })
  status: string;

  @ApiProperty({ type: [String] })
  roles: string[];
}
