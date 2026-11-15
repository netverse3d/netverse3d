import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@netverse/nest-kit';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { ReconciliationRunResponseDto } from '../dto/reconciliation-response.dto';
import { ReconciliationService } from '../services/reconciliation.service';

@ApiTags('Reconciliation Admin')
@Roles('platform_admin')
@Controller('internal/reconciliation')
export class ReconciliationAdminController {
  constructor(private readonly service: ReconciliationService) {}

  @Post('run')
  @Audit({ action: 'reconciliation.run', resourceType: 'reconciliation' })
  @ApiOperation({
    summary: 'Run one reconciliation cycle now (queries providers for attempts without a result)',
  })
  @ApiEnvelope(ReconciliationRunResponseDto, 201)
  run() {
    return this.service.runOnce();
  }
}
