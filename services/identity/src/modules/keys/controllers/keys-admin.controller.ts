import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Roles } from '@netverse/nest-kit';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit, AuditResourceInput } from '@netverse/nest-kit';
import { PLATFORM_ADMIN_ROLE } from '../../tenancy/domain/platform-roles';
import { KeysService } from '../services/keys.service';

class RotateResultDto {
  @ApiProperty()
  activeKid: string;

  @ApiProperty({ type: String, nullable: true })
  retiringKid: string | null;
}

class SigningKeySummaryDto {
  @ApiProperty()
  kid: string;

  @ApiProperty({ enum: ['ACTIVE', 'RETIRING', 'REVOKED'] })
  status: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

class SigningKeyListDto {
  @ApiProperty({ type: [SigningKeySummaryDto] })
  keys: SigningKeySummaryDto[];
}

const rotatedKid = ({ result }: AuditResourceInput) =>
  (result as RotateResultDto | undefined)?.activeKid;

@ApiTags('keys')
@Roles(PLATFORM_ADMIN_ROLE)
@Controller('admin/keys')
export class KeysAdminController {
  constructor(private readonly keys: KeysService) {}

  @Get()
  @ApiOperation({ summary: 'List signing keys without private material' })
  @ApiEnvelope(SigningKeyListDto)
  async list(): Promise<SigningKeyListDto> {
    const rows = await this.keys.list();
    return {
      keys: rows.map((row) => ({
        kid: row.kid,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  @Post('rotate')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'key.rotate', resourceType: 'signing_key', resourceId: rotatedKid })
  @ApiOperation({ summary: 'Create a new active key and keep the old one for verification' })
  @ApiEnvelope(RotateResultDto)
  rotate(): Promise<RotateResultDto> {
    return this.keys.rotate();
  }
}
