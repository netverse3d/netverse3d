import { scopeKeyOf, topicFor } from '../../../../../src/modules/outbox/domain/event-topic';

const envelope = (data: Record<string, unknown>) => ({
  id: '11111111-2222-4333-8444-555555555555',
  type: 'user.registered',
  source: 'identity',
  occurredAt: '2026-11-13T08:00:00.000Z',
  version: 1,
  data,
});

describe('topic và khoá của sự kiện', () => {
  it('mỗi service một topic, có số phiên bản hợp đồng', () => {
    expect(topicFor('identity')).toBe('netverse.identity.events.v1');
    expect(topicFor('media')).toBe('netverse.media.events.v1');
  });

  it('tên service lạ dạng bị từ chối, để không sinh topic rác', () => {
    expect(() => topicFor('Identity Service')).toThrow('service name');
    expect(() => topicFor('')).toThrow('service name');
  });

  it('khoá thông điệp là tenant của sự kiện, để giữ thứ tự trong một tiệm', () => {
    expect(scopeKeyOf(envelope({ tenantId: 'tenant-a' }))).toBe('tenant-a');
  });

  it('sự kiện không thuộc tiệm nào mang khoá của phạm vi nền tảng', () => {
    expect(scopeKeyOf(envelope({ tenantId: null }))).toBe('platform');
    expect(scopeKeyOf(envelope({}))).toBe('platform');
  });
});
