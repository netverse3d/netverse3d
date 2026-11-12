import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import {
  ChangePasswordDto,
  LinkIdentityDto,
  ProviderParamDto,
  UpdateProfileDto,
} from '../dto/identity-request.dto';
import {
  AcceptedDto,
  LinkedIdentityListDto,
  ProfileDto,
  SessionListDto,
} from '../dto/identity-response.dto';
import { AccountService } from '../services/account.service';
import { CredentialService } from '../services/credential.service';
import { SocialLoginService } from '../services/social-login.service';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly account: AccountService,
    private readonly credentials: CredentialService,
    private readonly social: SocialLoginService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current account and tenant memberships' })
  @ApiEnvelope(ProfileDto)
  profile(@CurrentActor() actor: Actor): Promise<ProfileDto> {
    return this.account.profile(actor.subject);
  }

  @Patch()
  @Audit({ action: 'principal.update_profile', resourceType: 'principal' })
  @ApiOperation({ summary: 'Update display name and avatar' })
  @ApiEnvelope(ProfileDto)
  update(@Body() dto: UpdateProfileDto, @CurrentActor() actor: Actor): Promise<ProfileDto> {
    return this.account.updateProfile(actor.subject, dto);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'principal.change_password', resourceType: 'principal' })
  @ApiOperation({ summary: 'Change password and end every session' })
  @ApiEnvelope(AcceptedDto)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentActor() actor: Actor,
  ): Promise<AcceptedDto> {
    await this.credentials.changePassword(actor.subject, dto.currentPassword, dto.newPassword);
    return { accepted: true };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions' })
  @ApiEnvelope(SessionListDto)
  listSessions(@CurrentActor() actor: Actor): Promise<SessionListDto> {
    return this.account.listSessions(actor);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'session.revoke', resourceType: 'session' })
  @ApiOperation({ summary: 'End one session' })
  @ApiNoContentResponse()
  revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    return this.account.revokeSession(actor.subject, id);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'session.revoke_all', resourceType: 'principal' })
  @ApiOperation({ summary: 'End every session and invalidate issued tokens' })
  @ApiEnvelope(AcceptedDto)
  async logoutAll(@CurrentActor() actor: Actor): Promise<AcceptedDto> {
    await this.credentials.logoutEverywhere(actor.subject);
    return { accepted: true };
  }

  @Get('identities')
  @ApiOperation({ summary: 'List linked sign-in providers' })
  @ApiEnvelope(LinkedIdentityListDto)
  async listIdentities(@CurrentActor() actor: Actor): Promise<LinkedIdentityListDto> {
    const rows = await this.social.listLinked(actor.subject);
    return {
      identities: rows.map((row) => ({
        provider: row.provider,
        email: row.email,
        linkedAt: row.createdAt.toISOString(),
      })),
    };
  }

  @Post('identities/:provider')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'identity.link', resourceType: 'principal' })
  @ApiOperation({ summary: 'Link a sign-in provider to this account' })
  @ApiEnvelope(AcceptedDto)
  async link(
    @Param() { provider }: ProviderParamDto,
    @Body() dto: LinkIdentityDto,
    @CurrentActor() actor: Actor,
  ): Promise<AcceptedDto> {
    await this.social.link(actor.subject, provider, {
      credential: dto.credential,
      redirectUri: dto.redirectUri,
    });
    return { accepted: true };
  }

  @Delete('identities/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'identity.unlink', resourceType: 'principal' })
  @ApiOperation({ summary: 'Unlink a sign-in provider' })
  @ApiNoContentResponse()
  unlink(@Param() { provider }: ProviderParamDto, @CurrentActor() actor: Actor): Promise<void> {
    return this.social.unlink(actor.subject, provider);
  }
}
