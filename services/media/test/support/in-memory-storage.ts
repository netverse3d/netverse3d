import { StoredObject } from '../../src/infrastructure/storage/storage.service';
import {
  StorageObjectMissingError,
  StorageUnavailableError,
} from '../../src/infrastructure/storage/storage.errors';

export class InMemoryStorage {
  readonly objects = new Map<string, StoredObject>();
  unavailable = false;

  get tempBucket(): string {
    return 'test-temp';
  }

  permanentBucket(visibility: string): string {
    return `test-${visibility.toLowerCase()}`;
  }

  put(bucket: string, key: string, size: number, contentType: string): void {
    this.objects.set(`${bucket}/${key}`, { size, contentType });
  }

  has(bucket: string, key: string): boolean {
    return this.objects.has(`${bucket}/${key}`);
  }

  async presignUpload(bucket: string, key: string): Promise<string> {
    this.assertAvailable(bucket, key);
    return `https://storage.test/${bucket}/${key}?signature=put`;
  }

  async presignDownload(bucket: string, key: string, ttlSeconds: number): Promise<string> {
    return `https://storage.test/${bucket}/${key}?signature=get&ttl=${ttlSeconds}`;
  }

  async stat(bucket: string, key: string): Promise<StoredObject> {
    this.assertAvailable(bucket, key);
    const object = this.objects.get(`${bucket}/${key}`);
    if (!object) {
      throw new StorageObjectMissingError(bucket, key);
    }
    return object;
  }

  async copy(
    sourceBucket: string,
    sourceKey: string,
    targetBucket: string,
    targetKey: string,
  ): Promise<void> {
    this.assertAvailable(sourceBucket, sourceKey);
    const object = await this.stat(sourceBucket, sourceKey);
    this.put(targetBucket, targetKey, object.size, object.contentType);
  }

  async remove(bucket: string, key: string): Promise<void> {
    this.assertAvailable(bucket, key);
    this.objects.delete(`${bucket}/${key}`);
  }

  async ping(): Promise<void> {
    this.assertAvailable('ping', 'ping');
  }

  private assertAvailable(bucket: string, key: string): void {
    if (this.unavailable) {
      throw new StorageUnavailableError(bucket, key, 1, 'test outage');
    }
  }
}
