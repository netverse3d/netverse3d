import type { Actor } from '../../../common/context/request-context';
import { AccessibleMedia, canChange, canDownload, canRead } from './media-access';

const owner: Actor = { subject: 'owner', tenantId: 't1', roles: [] };
const colleague: Actor = { subject: 'colleague', tenantId: 't1', roles: [] };
const manager: Actor = { subject: 'manager', tenantId: 't1', roles: ['admin'] };
const foreignManager: Actor = { subject: 'foreign', tenantId: 't2', roles: ['admin'] };

const media = (overrides: Partial<AccessibleMedia> = {}): AccessibleMedia => ({
  tenantId: 't1',
  createdBy: 'owner',
  visibility: 'PRIVATE',
  moderationStatus: 'NOT_REQUIRED',
  ...overrides,
});

describe('quyền trên media', () => {
  it('quản trị tenant khác không đọc, không đổi được', () => {
    expect(canRead(media({ visibility: 'PUBLIC' }), foreignManager)).toBe(false);
    expect(canChange(media(), foreignManager)).toBe(false);
  });

  it('media riêng tư chỉ người tạo và quản trị đọc được', () => {
    expect(canRead(media(), owner)).toBe(true);
    expect(canRead(media(), manager)).toBe(true);
    expect(canRead(media(), colleague)).toBe(false);
  });

  it('media nội bộ đồng nghiệp đọc được nhưng không đổi được', () => {
    const internal = media({ visibility: 'INTERNAL' });
    expect(canRead(internal, colleague)).toBe(true);
    expect(canChange(internal, colleague)).toBe(false);
  });

  it('media chờ duyệt chỉ người tạo và quản trị tải được', () => {
    const pending = media({ visibility: 'INTERNAL', moderationStatus: 'PENDING' });
    expect(canDownload(pending, owner)).toBe(true);
    expect(canDownload(pending, manager)).toBe(true);
    expect(canDownload(pending, colleague)).toBe(false);
  });

  it('media bị từ chối chỉ quản trị tải được, kể cả người tạo cũng không', () => {
    const rejected = media({ moderationStatus: 'REJECTED' });
    expect(canDownload(rejected, manager)).toBe(true);
    expect(canDownload(rejected, owner)).toBe(false);
  });
});
