const EXTENSION_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'model/gltf-binary': '.glb',
  'model/gltf+json': '.gltf',
  'application/pdf': '.pdf',
};

const EQUIVALENT_EXTENSIONS: Readonly<Record<string, string>> = { '.jpeg': '.jpg' };

const KNOWN_EXTENSIONS = new Set([
  ...Object.values(EXTENSION_BY_CONTENT_TYPE),
  ...Object.keys(EQUIVALENT_EXTENSIONS),
]);

export function normalizeContentType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}

export function objectFileName(
  originalFilename: string | null | undefined,
  contentType: string,
): string {
  const safeName = originalFilename?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
  const extension = EXTENSION_BY_CONTENT_TYPE[normalizeContentType(contentType)];
  if (!extension) {
    return safeName;
  }
  const dot = safeName.lastIndexOf('.');
  const current = dot > 0 ? safeName.slice(dot).toLowerCase() : '';
  if ((EQUIVALENT_EXTENSIONS[current] ?? current) === extension) {
    return safeName;
  }
  const stem = KNOWN_EXTENSIONS.has(current) ? safeName.slice(0, dot) : safeName;
  return `${stem}${extension}`;
}
