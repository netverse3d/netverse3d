import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { Public } from '@netverse/nest-kit';
import { ApiEnvelope } from '@netverse/nest-kit';
import { AuthThrottle } from '@netverse/nest-kit';
import {
  EmailDto,
  LoginDto,
  ProviderParamDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
  SwitchTenantDto,
  VerifyEmailDto,
} from '../dto/identity-request.dto';
import { AcceptedDto, ProvidersDto, TokenPairDto } from '../dto/identity-response.dto';
import { CredentialService } from '../services/credential.service';
import { SocialLoginService } from '../services/social-login.service';
import { TokenService } from '../services/token.service';

const ACCEPTED: AcceptedDto = { accepted: true };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentials: CredentialService,
    private readonly social: SocialLoginService,
    private readonly tokens: TokenService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  @AuthThrottle()
  @ApiOperation({
    summary: 'Register with email and password; the answer never reveals whether the email exists',
  })
  @ApiEnvelope(AcceptedDto, HttpStatus.ACCEPTED)
  async register(@Body() dto: RegisterDto): Promise<AcceptedDto> {
    await this.credentials.register(dto.email, dto.password, dto.displayName);
    return ACCEPTED;
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Public()
  @AuthThrottle()
  @ApiOperation({ summary: 'Confirm an email address with a one-time code' })
  @ApiEnvelope(AcceptedDto)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<AcceptedDto> {
    await this.credentials.verifyEmail(dto.email, dto.code);
    return ACCEPTED;
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  @AuthThrottle()
  @ApiOperation({ summary: 'Send a new verification code' })
  @ApiEnvelope(AcceptedDto, HttpStatus.ACCEPTED)
  async resendVerification(@Body() dto: EmailDto): Promise<AcceptedDto> {
    await this.credentials.resendVerification(dto.email);
    return ACCEPTED;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  @AuthThrottle()
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiEnvelope(TokenPairDto)
  login(@Body() dto: LoginDto): Promise<TokenPairDto> {
    return this.credentials.login(dto.email, dto.password, dto.tenantId ?? null);
  }

  @Get('providers')
  @Public()
  @ApiOperation({ summary: 'List enabled sign-in providers' })
  @ApiEnvelope(ProvidersDto)
  providers(): ProvidersDto {
    return { providers: this.social.enabledProviders() };
  }

  @Post('social/:provider')
  @HttpCode(HttpStatus.OK)
  @Public()
  @AuthThrottle()
  @ApiOperation({ summary: 'Sign in with a provider credential' })
  @ApiEnvelope(TokenPairDto)
  socialLogin(
    @Param() { provider }: ProviderParamDto,
    @Body() dto: SocialLoginDto,
  ): Promise<TokenPairDto> {
    return this.social.login(
      provider,
      { credential: dto.credential, redirectUri: dto.redirectUri },
      dto.tenantId ?? null,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiEnvelope(TokenPairDto)
  refresh(@Body() dto: RefreshDto): Promise<TokenPairDto> {
    return this.tokens.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'End the session of a refresh token' })
  @ApiEnvelope(AcceptedDto)
  async logout(@Body() dto: RefreshDto): Promise<AcceptedDto> {
    await this.tokens.revokeByRefreshToken(dto.refreshToken);
    return ACCEPTED;
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  @AuthThrottle()
  @ApiOperation({
    summary: 'Send a password reset code; the answer never reveals whether the email exists',
  })
  @ApiEnvelope(AcceptedDto, HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: EmailDto): Promise<AcceptedDto> {
    await this.credentials.forgotPassword(dto.email);
    return ACCEPTED;
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Public()
  @AuthThrottle()
  @ApiOperation({ summary: 'Set a new password with a reset code and end every session' })
  @ApiEnvelope(AcceptedDto)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<AcceptedDto> {
    await this.credentials.resetPassword(dto.email, dto.code, dto.newPassword);
    return ACCEPTED;
  }

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a session scoped to another tenant' })
  @ApiEnvelope(TokenPairDto)
  async switchTenant(
    @Body() dto: SwitchTenantDto,
    @CurrentActor() actor: Actor,
  ): Promise<TokenPairDto> {
    return this.tokens.startSession(
      await this.credentials.requirePrincipal(actor.subject),
      dto.tenantId,
    );
  }
}
