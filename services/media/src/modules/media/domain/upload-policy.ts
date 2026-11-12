import { AppException } from '../../../common/errors/app.exception';
import type { UploadPolicy } from '../../../config/app-config';
import { MediaErrorCode } from '../media-error-codes';
import { normalizeContentType } from './object-file-name';

function matchesPattern(contentType: string, pattern: string): boolean {
  return pattern.endsWith('/*')
    ? contentType.startsWith(pattern.slice(0, -1))
    : contentType === pattern;
}

export function assertContentTypeAllowed(contentType: string, policy: UploadPolicy): void {
  const normalized = normalizeContentType(contentType);
  if (!policy.allowedTypes.some((pattern) => matchesPattern(normalized, pattern))) {
    throw new AppException(MediaErrorCode.TYPE_NOT_ALLOWED, {
      details: { contentType: normalized, allowedTypes: policy.allowedTypes },
    });
  }
}

export function assertSizeAllowed(sizeBytes: number, policy: UploadPolicy): void {
  if (sizeBytes > policy.maxBytes) {
    throw new AppException(MediaErrorCode.SIZE_EXCEEDED, {
      details: { maxBytes: policy.maxBytes },
    });
  }
}
