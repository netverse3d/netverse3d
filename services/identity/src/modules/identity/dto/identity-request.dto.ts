import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SOCIAL_PROVIDERS, SocialProviderName } from '../social/social-provider';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export class RegisterDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}

export class EmailDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class VerifyEmailDto extends EmailDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX)
  password: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class SocialLoginDto {
  @ApiProperty({
    description: 'ID token, access token or authorization code, depending on the provider',
  })
  @IsString()
  @Length(1, 8192)
  credential: string;

  @ApiPropertyOptional({ description: 'Required when the provider exchanged a code' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUri?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class LinkIdentityDto {
  @ApiProperty()
  @IsString()
  @Length(1, 8192)
  credential: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUri?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Length(20, 256)
  refreshToken: string;
}

export class ResetPasswordDto extends VerifyEmailDto {
  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX)
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  newPassword: string;
}

export class SwitchTenantDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 1024 })
  @IsOptional()
  @IsUrl()
  @MaxLength(1024)
  avatarUrl?: string;
}

export class ProviderParamDto {
  @ApiProperty({ enum: SOCIAL_PROVIDERS })
  @IsIn(SOCIAL_PROVIDERS)
  provider: SocialProviderName;
}
