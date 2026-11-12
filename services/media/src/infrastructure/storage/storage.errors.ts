export class StorageObjectMissingError extends Error {
  constructor(bucket: string, key: string) {
    super(`object ${bucket}/${key} is missing`);
    this.name = 'StorageObjectMissingError';
  }
}

export class StorageUnavailableError extends Error {
  constructor(bucket: string, key: string, attempts: number, lastCause: string) {
    super(`storage did not confirm ${bucket}/${key} after ${attempts} attempt(s): ${lastCause}`);
    this.name = 'StorageUnavailableError';
  }
}
