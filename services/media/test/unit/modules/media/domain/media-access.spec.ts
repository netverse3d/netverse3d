import type { Actor } from '@netverse/nest-kit';
import {
  AccessibleMedia,
  canChange,
  canDownload,
  canModerate,
  canRead,
  canUploadSystemAsset,
  ownsUploadTarget,
} from '../../../../../src/modules/media/domain/media-access';

const owner: Actor = { subject: 'owner', tenantId: 't1', roles: [] };
const colleague: Actor = { subject: 'colleague', tenantId: 't1', roles: [] };
const shopAdmin: Actor = { subject: 'manager', tenantId: 't1', roles: ['admin'] };
const foreignAdmin: Actor = { subject: 'foreign', tenantId: 't2', roles: ['admin'] };
const forgedPlatform: Actor = { subject: 'forged', tenantId: 't1', roles: ['platform_admin'] };
const platform: Actor = { subject: 'platform', tenantId: null, roles: ['platform_admin'] };
const player: Actor = { subject: 'player', tenantId: null, roles: [] };
const otherPlayer: Actor = { subject: 'other-player', tenantId: null, roles: [] };
const tenantlessAdmin: Actor = { subject: 'odd', tenantId: null, roles: ['admin'] };

const media = (overrides: Partial<AccessibleMedia> = {}): AccessibleMedia => ({
  tenantId: 't1',
  createdBy: 'owner',
  visibility: 'PRIVATE',
  moderationStatus: 'NOT_REQUIRED',
  ...overrides,
});
const playerMedia = (overrides: Partial<AccessibleMedia> = {}): AccessibleMedia =>
  media({ tenantId: null, createdBy: 'player', ...overrides });

describe('quyền trên media của một tiệm', () => {
  it('quản trị tiệm khác không đọc, không đổi được', () => {
    expect(canRead(media({ visibility: 'PUBLIC' }), foreignAdmin)).toBe(false);
    expect(canChange(media(), foreignAdmin)).toBe(false);
  });

  it('media riêng tư chỉ người tạo và quản trị tiệm đọc được', () => {
    expect(canRead(media(), owner)).toBe(true);
    expect(canRead(media(), shopAdmin)).toBe(true);
    expect(canRead(media(), colleague)).toBe(false);
  });

  it('media nội bộ đồng nghiệp đọc được nhưng không đổi được', () => {
    const internal = media({ visibility: 'INTERNAL' });
    expect(canRead(internal, colleague)).toBe(true);
    expect(canChange(internal, colleague)).toBe(false);
  });

  it('người chơi không đọc được media của tiệm, kể cả media công khai', () => {
    expect(canRead(media({ visibility: 'PUBLIC' }), player)).toBe(false);
  });
});

describe('quyền trên media không gắn tenant', () => {
  it('người chơi đọc và đổi được media của chính mình', () => {
    expect(canRead(playerMedia(), player)).toBe(true);
    expect(canChange(playerMedia(), player)).toBe(true);
  });

  it('người chơi khác không đọc được media riêng tư hay nội bộ của người chơi này', () => {
    expect(canRead(playerMedia(), otherPlayer)).toBe(false);
    expect(canRead(playerMedia({ visibility: 'INTERNAL' }), otherPlayer)).toBe(false);
  });

  it('media công khai không gắn tenant thì ai đã đăng nhập cũng đọc được, nhưng không đổi được', () => {
    const shared = playerMedia({ visibility: 'PUBLIC' });
    expect(canRead(shared, otherPlayer)).toBe(true);
    expect(canRead(shared, owner)).toBe(true);
    expect(canChange(shared, otherPlayer)).toBe(false);
  });

  it('vai trò admin trên token không gắn tenant không cho thêm quyền gì', () => {
    expect(canRead(playerMedia(), tenantlessAdmin)).toBe(false);
    expect(canChange(playerMedia(), tenantlessAdmin)).toBe(false);
  });
});

describe('quyền của quản trị nền tảng', () => {
  it('đọc và đổi được media của mọi tiệm và của người chơi', () => {
    expect(canRead(media(), platform)).toBe(true);
    expect(canChange(media(), platform)).toBe(true);
    expect(canRead(playerMedia(), platform)).toBe(true);
  });

  it('chỉ quản trị nền tảng duyệt được nội dung và tải được asset hệ thống', () => {
    expect(canModerate(platform)).toBe(true);
    expect(canUploadSystemAsset(platform)).toBe(true);
    expect(canModerate(shopAdmin)).toBe(false);
    expect(canUploadSystemAsset(shopAdmin)).toBe(false);
    expect(canModerate(forgedPlatform)).toBe(false);
    expect(canModerate(player)).toBe(false);
  });
});

describe('tải media theo trạng thái duyệt', () => {
  it('media chờ duyệt chỉ người tạo và quản trị nền tảng tải được', () => {
    const pending = media({ visibility: 'INTERNAL', moderationStatus: 'PENDING' });
    expect(canDownload(pending, owner)).toBe(true);
    expect(canDownload(pending, platform)).toBe(true);
    expect(canDownload(pending, colleague)).toBe(false);
    expect(canDownload(pending, shopAdmin)).toBe(false);
  });

  it('media bị từ chối chỉ quản trị nền tảng tải được, người tạo và quản trị tiệm thì không', () => {
    const rejected = media({ moderationStatus: 'REJECTED' });
    expect(canDownload(rejected, platform)).toBe(true);
    expect(canDownload(rejected, owner)).toBe(false);
    expect(canDownload(rejected, shopAdmin)).toBe(false);
  });
});

describe('mã chủ sở hữu lúc tải lên', () => {
  it('người chơi chỉ tải lên được dưới mã chủ sở hữu là chính mình', () => {
    expect(ownsUploadTarget(player, 'player')).toBe(true);
    expect(ownsUploadTarget(player, 'other-player')).toBe(false);
  });

  it('thành viên của tiệm và quản trị nền tảng đặt được mã chủ sở hữu bất kỳ', () => {
    expect(ownsUploadTarget(owner, 'shop-sign')).toBe(true);
    expect(ownsUploadTarget(platform, 'lobby-music')).toBe(true);
  });
});
