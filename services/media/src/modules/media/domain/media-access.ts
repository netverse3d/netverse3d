import { isPlatformAdmin, isTenantAdmin, type Actor } from '@netverse/nest-kit';

export interface AccessibleMedia {
  tenantId: string | null;
  createdBy: string;
  visibility: 'PRIVATE' | 'INTERNAL' | 'PUBLIC';
  moderationStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface MediaListScope {
  tenantId: string | null | undefined;
  viewerSubject: string | null;
  sharedVisibilities: AccessibleMedia['visibility'][];
}

function isCreator(media: AccessibleMedia, actor: Actor): boolean {
  return media.createdBy === actor.subject;
}

function isOpenToEveryone(media: AccessibleMedia): boolean {
  return media.tenantId === null && media.visibility === 'PUBLIC';
}

function inActorTenant(media: AccessibleMedia, actor: Actor): boolean {
  return actor.tenantId !== null && media.tenantId === actor.tenantId;
}

export function canModerate(actor: Actor): boolean {
  return isPlatformAdmin(actor);
}

export function canUploadSystemAsset(actor: Actor): boolean {
  return isPlatformAdmin(actor);
}

export function canRead(media: AccessibleMedia, actor: Actor): boolean {
  if (isPlatformAdmin(actor) || isOpenToEveryone(media)) {
    return true;
  }
  if (inActorTenant(media, actor)) {
    return media.visibility !== 'PRIVATE' || isCreator(media, actor) || isTenantAdmin(actor);
  }
  return actor.tenantId === null && media.tenantId === null && isCreator(media, actor);
}

export function canChange(media: AccessibleMedia, actor: Actor): boolean {
  if (isPlatformAdmin(actor)) {
    return true;
  }
  if (inActorTenant(media, actor)) {
    return isCreator(media, actor) || isTenantAdmin(actor);
  }
  return actor.tenantId === null && media.tenantId === null && isCreator(media, actor);
}

export function canDownload(media: AccessibleMedia, actor: Actor): boolean {
  if (isPlatformAdmin(actor)) {
    return true;
  }
  if (media.moderationStatus === 'REJECTED') {
    return false;
  }
  return media.moderationStatus !== 'PENDING' || isCreator(media, actor);
}

export function ownsUploadTarget(actor: Actor, ownerId: string): boolean {
  return actor.tenantId !== null || isPlatformAdmin(actor) || ownerId === actor.subject;
}

export function listScopeFor(actor: Actor): MediaListScope {
  if (isPlatformAdmin(actor)) {
    return { tenantId: undefined, viewerSubject: null, sharedVisibilities: [] };
  }
  if (actor.tenantId === null) {
    return { tenantId: null, viewerSubject: actor.subject, sharedVisibilities: ['PUBLIC'] };
  }
  return {
    tenantId: actor.tenantId,
    viewerSubject: isTenantAdmin(actor) ? null : actor.subject,
    sharedVisibilities: ['INTERNAL', 'PUBLIC'],
  };
}
