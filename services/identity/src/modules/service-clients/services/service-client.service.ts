import { Injectable } from '@nestjs/common';
import {
  AppException,
  databaseErrorCode,
  PageResponseDto,
  PaginationQueryDto,
} from '@netverse/nest-kit';
import { AppConfig } from '../../../config/app-config';
import { IdentityErrorCode } from '../../identity/identity-error-codes';
import { KeysService } from '../../keys/services/keys.service';
import { hashClientSecret, matchesClientSecret, newClientSecret } from '../domain/client-secret';
import {
  CreatedServiceClientDto,
  CreateServiceClientDto,
  RotatedSecretDto,
  ServiceClientDto,
  ServiceTokenDto,
  ServiceTokenRequestDto,
} from '../dto/service-client.dto';
import {
  ServiceClientRepository,
  ServiceClientRow,
} from '../repositories/service-client.repository';

const UNIQUE_VIOLATION = 'P2002';
const UNUSABLE_HASH = hashClientSecret(newClientSecret());

@Injectable()
export class ServiceClientService {
  constructor(
    private readonly repository: ServiceClientRepository,
    private readonly keys: KeysService,
    private readonly config: AppConfig,
  ) {}

  async create(dto: CreateServiceClientDto): Promise<CreatedServiceClientDto> {
    const unknown = dto.audiences.filter(
      (audience) => !this.config.tokens.audiences.includes(audience),
    );
    if (unknown.length > 0) {
      throw new AppException(IdentityErrorCode.AUDIENCE_UNKNOWN, { details: { unknown } });
    }
    const clientSecret = newClientSecret();
    try {
      const row = await this.repository.create({
        name: dto.name,
        secretHash: hashClientSecret(clientSecret),
        audiences: dto.audiences,
        permissions: dto.permissions,
      });
      return { ...ServiceClientDto.from(row), clientSecret };
    } catch (error) {
      if (databaseErrorCode(error) === UNIQUE_VIOLATION) {
        throw new AppException(IdentityErrorCode.SERVICE_CLIENT_NAME_TAKEN);
      }
      throw error;
    }
  }

  async list(query: PaginationQueryDto): Promise<PageResponseDto<ServiceClientDto>> {
    const [rows, total] = await this.repository.findPage(query.skip, query.take);
    return PageResponseDto.of(rows.map(ServiceClientDto.from), query, total);
  }

  async rotateSecret(id: string): Promise<RotatedSecretDto> {
    const clientSecret = newClientSecret();
    if ((await this.repository.replaceSecretOfActive(id, hashClientSecret(clientSecret))) === 0) {
      throw new AppException(IdentityErrorCode.SERVICE_CLIENT_NOT_FOUND);
    }
    return { clientSecret };
  }

  async revoke(id: string): Promise<void> {
    if ((await this.repository.revokeActive(id)) === 0) {
      throw new AppException(IdentityErrorCode.SERVICE_CLIENT_NOT_FOUND);
    }
  }

  async issueToken(dto: ServiceTokenRequestDto): Promise<ServiceTokenDto> {
    const client = await this.authenticate(dto.clientId, dto.clientSecret);
    const stillIssued = this.config.tokens.audiences.includes(dto.audience);
    if (!stillIssued || !client.audiences.includes(dto.audience)) {
      throw new AppException(IdentityErrorCode.AUDIENCE_NOT_ALLOWED);
    }
    const ttlSeconds = this.config.tokens.serviceTtlSeconds;
    const accessToken = await this.keys.sign(
      { client_id: client.id, permissions: client.permissions },
      `service:${client.name}`,
      { audience: dto.audience, ttlSeconds },
    );
    return ServiceTokenDto.of(accessToken, ttlSeconds);
  }

  private async authenticate(clientId: string, clientSecret: string): Promise<ServiceClientRow> {
    const client = await this.repository.findById(clientId);
    const secretMatches = matchesClientSecret(clientSecret, client?.secretHash ?? UNUSABLE_HASH);
    if (!client || client.status !== 'ACTIVE' || !secretMatches) {
      throw new AppException(IdentityErrorCode.SERVICE_CLIENT_INVALID);
    }
    return client;
  }
}
