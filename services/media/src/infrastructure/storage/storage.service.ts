import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, CopyConditions } from 'minio';
import { AppConfig, S3Endpoint } from '../../config/app-config';
import { StorageObjectMissingError, StorageUnavailableError } from './storage.errors';

const STAT_RETRY_DELAYS_MS = [200, 600];
const OBJECT_MISSING_CODES = new Set(['NotFound', 'NoSuchKey']);

export type BucketVisibility = 'PRIVATE' | 'INTERNAL' | 'PUBLIC';

export interface StoredObject {
  size: number;
  contentType: string;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function isObjectMissing(error: unknown): boolean {
  return OBJECT_MISSING_CODES.has((error as { code?: string } | null)?.code ?? '');
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly presignClient: Client;

  constructor(private readonly config: AppConfig) {
    this.client = this.buildClient(config.storage.internal);
    this.presignClient = this.buildClient(config.storage.public);
  }

  private buildClient(endpoint: S3Endpoint): Client {
    const { region, accessKey, secretKey } = this.config.storage;
    return new Client({ ...endpoint, region, accessKey, secretKey });
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.storage.autoCreateBuckets) {
      return;
    }
    const { region, buckets } = this.config.storage;
    for (const bucket of Object.values(buckets)) {
      if (!(await this.client.bucketExists(bucket))) {
        await this.client.makeBucket(bucket, region);
        this.logger.log(`created bucket ${bucket}`);
      }
    }
  }

  get tempBucket(): string {
    return this.config.storage.buckets.temp;
  }

  permanentBucket(visibility: BucketVisibility): string {
    const { buckets } = this.config.storage;
    const byVisibility: Record<BucketVisibility, string> = {
      PRIVATE: buckets.private,
      INTERNAL: buckets.internal,
      PUBLIC: buckets.public,
    };
    return byVisibility[visibility];
  }

  presignUpload(bucket: string, key: string): Promise<string> {
    return this.presignClient.presignedPutObject(
      bucket,
      key,
      this.config.storage.uploadUrlTtlSeconds,
    );
  }

  presignDownload(
    bucket: string,
    key: string,
    ttlSeconds: number,
    contentDisposition?: string,
  ): Promise<string> {
    const params: Record<string, string> = contentDisposition
      ? { 'response-content-disposition': contentDisposition }
      : {};
    return this.presignClient.presignedGetObject(bucket, key, ttlSeconds, params);
  }

  async stat(bucket: string, key: string): Promise<StoredObject> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const stat = await this.client.statObject(bucket, key);
        return {
          size: stat.size,
          contentType: String(stat.metaData['content-type'] ?? ''),
        };
      } catch (error) {
        if (isObjectMissing(error)) {
          throw new StorageObjectMissingError(bucket, key);
        }
        if (attempt > STAT_RETRY_DELAYS_MS.length) {
          throw new StorageUnavailableError(bucket, key, attempt, describe(error));
        }
        await new Promise((resolve) => setTimeout(resolve, STAT_RETRY_DELAYS_MS[attempt - 1]));
      }
    }
  }

  async copy(
    sourceBucket: string,
    sourceKey: string,
    targetBucket: string,
    targetKey: string,
  ): Promise<void> {
    await this.client.copyObject(
      targetBucket,
      targetKey,
      `/${sourceBucket}/${sourceKey}`,
      new CopyConditions(),
    );
  }

  async remove(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  async ping(): Promise<void> {
    await this.client.bucketExists(this.config.storage.buckets.private);
  }
}
