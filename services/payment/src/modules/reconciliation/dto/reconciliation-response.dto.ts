import { ApiProperty } from '@nestjs/swagger';

export class ExpiredAttemptsSummaryDto {
  @ApiProperty() checked: number;
  @ApiProperty() applied: number;
}

export class RefundReconcileSummaryDto {
  @ApiProperty() checked: number;
  @ApiProperty() applied: number;
  @ApiProperty() errors: number;
}

export class ReconciliationRunResponseDto {
  @ApiProperty() checked: number;
  @ApiProperty() unchanged: number;
  @ApiProperty() applied: number;
  @ApiProperty() ignored: number;
  @ApiProperty() duplicate: number;
  @ApiProperty() error: number;
  @ApiProperty({ type: ExpiredAttemptsSummaryDto }) expired: ExpiredAttemptsSummaryDto;
  @ApiProperty({ type: RefundReconcileSummaryDto }) refunds: RefundReconcileSummaryDto;
}
