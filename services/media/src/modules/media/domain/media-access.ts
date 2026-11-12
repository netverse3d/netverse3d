import type { Actor } from '../../../common/context/request-context';

export const MEDIA_MANAGER_ROLE = 'admin';

export interface AccessibleMedia {
  tenantId: string | null;
  createdBy: string;
  visibility: 'PRIVATE' | 'INTERNAL' | 'PUBLIC';
  moderationStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export function isMediaManager(actor: Actor): boolean {
  return actor.roles.includes(MEDIA_MANAGER_ROLE);
}

function isOwnerOrManager(media: AccessibleMedia, actor: Actor): boolean {
  return media.createdBy === actor.subject || isMediaManager(actor);
}

export function canRead(media: AccessibleMedia, actor: Actor): boolean {
  return (
    media.tenantId === actor.tenantId &&
    (media.visibility !== 'PRIVATE' || isOwnerOrManager(media, actor))
  );
}

export function canChange(media: AccessibleMedia, actor: Actor): boolean {
  return media.tenantId === actor.tenantId && isOwnerOrManager(media, actor);
}

export function canDownload(media: AccessibleMedia, actor: Actor): boolean {
  if (media.moderationStatus === 'REJECTED') {
    return isMediaManager(actor);
  }
  return media.moderationStatus !== 'PENDING' || isOwnerOrManager(media, actor);
}
