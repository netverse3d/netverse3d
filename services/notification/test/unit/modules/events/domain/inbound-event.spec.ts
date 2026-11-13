import { InvalidEventError } from '../../../../../src/modules/events/ports/event-consumer';
import { parseInboundEvent } from '../../../../../src/modules/events/domain/inbound-event';

const valid = { id: 'e-1', tenantId: 't-1', eventType: 'a.b', recipient: { subject: 'u-1' } };

function parse(value: unknown): unknown {
  return parseInboundEvent(Buffer.from(JSON.stringify(value)));
}

describe('đọc sự kiện đầu vào', () => {
  it('nhận sự kiện hợp lệ và mặc định variables rỗng', () => {
    expect(parse(valid)).toMatchObject({ id: 'e-1', variables: {} });
  });

  it('từ chối thân không phải JSON', () => {
    expect(() => parseInboundEvent(Buffer.from('{oops'))).toThrow(InvalidEventError);
  });

  it.each([
    ['thiếu id', { ...valid, id: undefined }],
    ['thiếu tenant', { ...valid, tenantId: undefined }],
    ['loại sự kiện sai dạng', { ...valid, eventType: 'has space' }],
    ['thiếu recipient', { ...valid, recipient: undefined }],
    ['email sai', { ...valid, recipient: { email: 'x' } }],
    ['kênh lạ', { ...valid, channels: ['SMS'] }],
  ])('từ chối sự kiện %s', (_name, value) => {
    expect(() => parse(value)).toThrow(InvalidEventError);
  });

  it('thông báo lỗi chỉ nêu tên trường, không lộ giá trị', () => {
    expect(() => parse({ ...valid, recipient: { email: 'secret-value' } })).not.toThrow(
      'secret-value',
    );
  });
});
