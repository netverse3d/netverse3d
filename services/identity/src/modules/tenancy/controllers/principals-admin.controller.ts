import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@netverse/nest-kit';
import { Audit, AuditResourceInput } from '@netverse/nest-kit';
import { PLATFORM_ADMIN_ROLE } from '../domain/platform-roles';
import { TenancyService } from '../services/tenancy.service';

const principalIdParam = ({ params }: AuditResourceInput) => params.id;

@ApiTags('principals')
@Roles(PLATFORM_ADMIN_ROLE)
@Controller('admin/principals')
export class PrincipalsAdminController {
  constructor(private readonly tenancy: TenancyService) {}

  @Post(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'principal.suspend', resourceType: 'principal', resourceId: principalIdParam })
  @ApiOperation({ summary: 'Suspend an account and end every session' })
  @ApiNoContentResponse()
  suspend(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tenancy.setPrincipalStatus(id, 'SUSPENDED');
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'principal.activate', resourceType: 'principal', resourceId: principalIdParam })
  @ApiOperation({ summary: 'Reactivate an account' })
  @ApiNoContentResponse()
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tenancy.setPrincipalStatus(id, 'ACTIVE');
  }
}
