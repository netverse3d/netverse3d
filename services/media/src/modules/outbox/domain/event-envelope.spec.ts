import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import envelopeSchema from '@netverse/contracts/events/v1/envelope.schema.json';
import mediaSchema from '@netverse/contracts/events/v1/media.schema.json';
import { toEnvelope } from './event-envelope';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validateEnvelope = ajv.compile(envelopeSchema);
const validateMediaData = ajv.compile(mediaSchema);

const row = {
  id: '3f0c2b9e-6f6b-4c0b-9a5e-2d1f5a7b8c90',
  type: 'media.completed',
  aggregateId: '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b',
  tenantId: 'tenant-a',
  createdAt: new Date('2026-11-12T08:00:00.000Z'),
  payload: {
    mediaId: '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b',
    mediaClass: 'USER_CONTENT',
    status: 'ACTIVE',
    lifecycle: 'PERMANENT',
    moderationStatus: 'NOT_REQUIRED',
    ownerType: 'avatar',
    ownerId: 'user-1',
    contentType: 'image/png',
    createdBy: 'user-1',
  },
};

describe('vỏ sự kiện', () => {
  it('sự kiện đóng từ một dòng outbox hợp lệ theo vỏ chung của hệ thống', () => {
    const envelope = toEnvelope(row, 'media');
    expect([validateEnvelope(envelope), validateEnvelope.errors]).toEqual([true, null]);
  });

  it('mang đúng mã, loại, nguồn, thời điểm và phiên bản', () => {
    expect(toEnvelope(row, 'media')).toMatchObject({
      id: row.id,
      type: 'media.completed',
      source: 'media',
      occurredAt: '2026-11-12T08:00:00.000Z',
      version: 1,
    });
  });

  it('phần data hợp lệ theo hợp đồng sự kiện của media và có tenant', () => {
    const { data } = toEnvelope(row, 'media');
    expect([validateMediaData(data), validateMediaData.errors]).toEqual([true, null]);
    expect(data.tenantId).toBe('tenant-a');
  });

  it('loại sự kiện nằm trong danh sách hợp đồng đã khai', () => {
    expect(mediaSchema['x-event-types']).toContain(toEnvelope(row, 'media').type);
  });

  it('sự kiện không gắn tenant vẫn hợp lệ, tenant là null', () => {
    const { data } = toEnvelope({ ...row, tenantId: null }, 'media');
    expect(data.tenantId).toBeNull();
    expect(validateMediaData(data)).toBe(true);
  });

  it('không để lọt trường ngoài vỏ chung', () => {
    expect(Object.keys(toEnvelope(row, 'media')).sort()).toEqual([
      'data',
      'id',
      'occurredAt',
      'source',
      'type',
      'version',
    ]);
  });
});
