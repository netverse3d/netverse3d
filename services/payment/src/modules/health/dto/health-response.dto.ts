import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'] })
  status: 'ok';

  @ApiProperty({ example: '0.1.0' })
  version: string;
}
