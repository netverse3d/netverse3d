import { InvalidEventError } from '@netverse/nest-kit';
import {
  listenedSources,
  reactionTo,
  readEnvelope,
} from '../../../../../src/modules/events/domain/event-reactions';

const PRINCIPAL = '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b';
const TENANT = '3f0c2b9e-6f6b-4c0b-9a5e-2d1f5a7b8c90';

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    type: 'user.email-verified',
    source: 'identity',
    occurredAt: '2026-11-14T08:00:00.000Z',
    version: 1,
    data: { principalId: PRINCIPAL, tenantId: null, status: 'ACTIVE' },
    ...overrides,
  };
}

const read = (value: unknown) => readEnvelope(Buffer.from(JSON.stringify(value)));

describe('phản ứng của notification với sự kiện', () => {
  it('chỉ nghe nguồn có phản ứng được khai', () => {
    expect(listenedSources()).toEqual(['identity']);
  });

  it('xác minh email xong thì chào đúng tài khoản, ở phạm vi nền tảng, không mang dữ liệu thừa', () => {
    expect(reactionTo(read(envelope()))).toEqual({
      scope: 'platform',
      eventType: 'account.welcome',
      recipient: { subject: PRINCIPAL },
      variables: {},
    });
  });

  it('phạm vi của thông báo lấy từ sự kiện: có mã tiệm thì là tiệm đó', () => {
    const inShop = envelope({ data: { principalId: PRINCIPAL, tenantId: TENANT } });
    expect(reactionTo(read(inShop))?.scope).toBe(TENANT);
  });

  it.each([['user.registered'], ['membership.added'], ['user.deactivated']])(
    'sự kiện %s không có phản ứng',
    (type) => {
      expect(reactionTo(read(envelope({ type })))).toBeNull();
    },
  );

  it('nguồn không được nghe thì không có phản ứng', () => {
    expect(reactionTo(read(envelope({ source: 'media' })))).toBeNull();
  });

  it.each([
    ['không phải JSON', Buffer.from('{oops')],
    ['là mảng', Buffer.from('[]')],
    ['là chuỗi', Buffer.from('"event"')],
    ['thiếu nguồn', Buffer.from(JSON.stringify({ id: 'x', type: 'user.registered' }))],
    ['nguồn không phải chuỗi', Buffer.from(JSON.stringify({ source: 7 }))],
  ])('thân %s không đọc được thành vỏ sự kiện', (_name, payload) => {
    expect(() => readEnvelope(payload)).toThrow(InvalidEventError);
  });
});
