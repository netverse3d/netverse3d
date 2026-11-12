import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 900 })
  expiresIn: number;

  @ApiProperty({ type: String, nullable: true })
  tenantId: string | null;
}

export class AcceptedDto {
  @ApiProperty({ example: true })
  accepted: boolean;
}

export class ProvidersDto {
  @ApiProperty({ type: [String] })
  providers: string[];
}

export class MembershipSummaryDto {
  @ApiProperty({ format: 'uuid' })
  tenantId: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [String] })
  roles: string[];
}

export class ProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty({ type: String, nullable: true })
  displayName: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  hasPassword: boolean;

  @ApiProperty({ type: [MembershipSummaryDto] })
  memberships: MembershipSummaryDto[];
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, nullable: true })
  tenantId: string | null;

  @ApiProperty({ type: String, nullable: true })
  ip: string | null;

  @ApiProperty({ type: String, nullable: true })
  userAgent: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  lastUsedAt: string;

  @ApiProperty()
  current: boolean;
}

export class SessionListDto {
  @ApiProperty({ type: [SessionDto] })
  sessions: SessionDto[];
}

export class LinkedIdentityDto {
  @ApiProperty()
  provider: string;

  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty({ format: 'date-time' })
  linkedAt: string;
}

export class LinkedIdentityListDto {
  @ApiProperty({ type: [LinkedIdentityDto] })
  identities: LinkedIdentityDto[];
}
