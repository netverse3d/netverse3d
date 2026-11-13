import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import envelopeSchema from '@netverse/contracts/events/v1/envelope.schema.json';
import notificationSchema from '@netverse/contracts/events/v1/notification.schema.json';
import { toEnvelope } from '@netverse/nest-kit';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validateEnvelope = ajv.compile(envelopeSchema);
const validateDeliveryData = ajv.compile(notificationSchema);

const TENANT = 'tenant-a';
const outcome = (status: 'SENT' | 'SKIPPED' | 'DEAD', reason: string | null) => ({
  id: '11111111-2222-4333-8444-555555555555',
  type: `notification.delivery.${status.toLowerCase()}`,
  tenantId: TENANT,
  createdAt: new Date('2026-11-13T08:00:00.000Z'),
  payload: {
    deliveryId: '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b',
    notificationId: '3f0c2b9e-6f6b-4c0b-9a5e-2d1f5a7b8c90',
    eventType: 'account.welcome',
    channel: 'EMAIL',
    status,
    reason,
    attempts: 1,
  },
});

const samples = [
  outcome('SENT', null),
  outcome('SKIPPED', 'OPTED_OUT'),
  outcome('DEAD', 'TEMPLATE_NOT_FOUND'),
];

describe('sự kiện của notification', () => {
  it.each(samples)('$type hợp lệ theo vỏ chung và theo hợp đồng của notification', (sample) => {
    const envelope = toEnvelope(sample, 'notification');
    expect([validateEnvelope(envelope), validateEnvelope.errors]).toEqual([true, null]);
    expect([validateDeliveryData(envelope.data), validateDeliveryData.errors]).toEqual([
      true,
      null,
    ]);
  });

  it('các loại sự kiện mẫu trùng với danh sách hợp đồng đã khai', () => {
    expect(samples.map((sample) => sample.type).sort()).toEqual(
      [...notificationSchema['x-event-types']].sort(),
    );
  });

  it('hợp đồng không nhận trường lạ, để địa chỉ người nhận không lọt vào sự kiện', () => {
    const [first] = samples;
    const leaked = { ...toEnvelope(first as never, 'notification').data, destination: 'a@b.test' };
    expect(validateDeliveryData(leaked)).toBe(false);
  });
});
