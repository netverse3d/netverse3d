import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import envelopeSchema from '@netverse/contracts/events/v1/envelope.schema.json';
import identitySchema from '@netverse/contracts/events/v1/identity.schema.json';
import { toEnvelope } from '@netverse/nest-kit';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validateEnvelope = ajv.compile(envelopeSchema);
const validateIdentityData = ajv.compile(identitySchema);

const PRINCIPAL = '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b';
const TENANT = '3f0c2b9e-6f6b-4c0b-9a5e-2d1f5a7b8c90';
const stored = (type: string, tenantId: string | null, payload: Record<string, unknown>) => ({
  id: '11111111-2222-4333-8444-555555555555',
  type,
  tenantId,
  createdAt: new Date('2026-11-12T08:00:00.000Z'),
  payload,
});
const account = { principalId: PRINCIPAL, email: 'a@example.test', status: 'ACTIVE' };

const samples = [
  stored('user.registered', null, account),
  stored('user.email-verified', null, account),
  stored('user.deactivated', null, { principalId: PRINCIPAL, status: 'SUSPENDED' }),
  stored('user.reactivated', null, { principalId: PRINCIPAL, status: 'ACTIVE' }),
  stored('membership.added', TENANT, {
    principalId: PRINCIPAL,
    tenantId: TENANT,
    roles: ['owner'],
  }),
  stored('membership.revoked', TENANT, { principalId: PRINCIPAL, tenantId: TENANT, roles: [] }),
  stored('role.changed', TENANT, { principalId: PRINCIPAL, tenantId: TENANT, roles: ['staff'] }),
];

describe('sự kiện của identity', () => {
  it.each(samples)('$type hợp lệ theo vỏ chung và theo hợp đồng của identity', (sample) => {
    const envelope = toEnvelope(sample, 'identity');
    expect([validateEnvelope(envelope), validateEnvelope.errors]).toEqual([true, null]);
    expect([validateIdentityData(envelope.data), validateIdentityData.errors]).toEqual([
      true,
      null,
    ]);
  });

  it('các loại sự kiện mẫu trùng với danh sách hợp đồng đã khai', () => {
    expect(samples.map((sample) => sample.type).sort()).toEqual(
      [...identitySchema['x-event-types']].sort(),
    );
  });

  it('sự kiện không gắn tenant mang tenantId là null', () => {
    const [first] = samples;
    expect(first && toEnvelope(first, 'identity').data.tenantId).toBeNull();
  });
});
