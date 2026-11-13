import {
  EventContracts,
  InvalidEventError,
} from '../../../../../src/modules/outbox/domain/event-contracts';

const PRINCIPAL = '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b';
const envelope = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-2222-4333-8444-555555555555',
  type: 'user.registered',
  source: 'identity',
  occurredAt: '2026-11-13T08:00:00.000Z',
  version: 1,
  data: { principalId: PRINCIPAL, tenantId: null, email: 'a@example.test', status: 'ACTIVE' },
  ...overrides,
});

describe('kiểm sự kiện theo hợp đồng trước lúc phát', () => {
  const contracts = EventContracts.forService('identity');

  it('sự kiện đúng vỏ chung và đúng hợp đồng của service thì qua', () => {
    expect(() => contracts.assertValid(envelope())).not.toThrow();
  });

  it('sai vỏ chung bị từ chối và nêu trường sai', () => {
    expect(() => contracts.assertValid(envelope({ id: 'not-a-uuid' }))).toThrow(InvalidEventError);
    expect(() => contracts.assertValid(envelope({ id: 'not-a-uuid' }))).toThrow('/id');
  });

  it('loại sự kiện không có trong hợp đồng của service bị từ chối', () => {
    expect(() => contracts.assertValid(envelope({ type: 'user.renamed' }))).toThrow(
      'user.renamed is not declared',
    );
  });

  it('phần data sai hợp đồng bị từ chối', () => {
    const broken = envelope({ data: { tenantId: null } });
    expect(() => contracts.assertValid(broken)).toThrow(InvalidEventError);
  });

  it('service chưa công bố hợp đồng sự kiện thì chỉ kiểm vỏ chung', () => {
    const unpublished = EventContracts.forService('worker-jobs');
    expect(() =>
      unpublished.assertValid(envelope({ source: 'worker-jobs', type: 'job.finished', data: {} })),
    ).not.toThrow();
    expect(() => unpublished.assertValid(envelope({ version: 0 }))).toThrow(InvalidEventError);
  });
});
