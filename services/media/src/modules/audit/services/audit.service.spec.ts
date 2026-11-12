import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditService } from './audit.service';

const entry = { action: 'thing.create', resourceType: 'thing', outcome: 'SUCCESS' as const };

function serviceWith(insert: jest.Mock): AuditService {
  return new AuditService({ insert } as unknown as AuditLogRepository);
}

describe('ghi audit', () => {
  it('truyền lỗi ghi ra ngoài khi gọi trong giao dịch để giao dịch được huỷ', async () => {
    const service = serviceWith(jest.fn().mockRejectedValue(new Error('db down')));
    await expect(service.record(entry)).rejects.toThrow('db down');
  });

  it('không làm hỏng request đã thành công khi ghi audit nền thất bại', async () => {
    const service = serviceWith(jest.fn().mockRejectedValue(new Error('db down')));
    await expect(service.recordWithoutFailing(entry)).resolves.toBeUndefined();
  });

  it('ghi đủ các trường mặc định khi không có ngữ cảnh request', async () => {
    const insert = jest.fn().mockResolvedValue(undefined);
    await serviceWith(insert).record(entry);
    expect(insert.mock.calls[0][0]).toMatchObject({
      requestId: null,
      actorSubject: null,
      actorRoles: [],
      action: 'thing.create',
      outcome: 'SUCCESS',
      metadata: {},
    });
  });
});
