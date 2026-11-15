import {
  isPublicIpAddress,
  resolveWebhookTarget,
} from '@app/modules/tenant-webhooks/domain/webhook-target.util';

describe('đích webhook tenant', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fc00::1', '2001:db8::1'])(
    'từ chối địa chỉ IP không công khai %s',
    (address) => {
      expect(isPublicIpAddress(address)).toBe(false);
    },
  );

  it.each(['8.8.8.8', '2606:4700:4700::1111'])('chấp nhận địa chỉ IP công khai %s', (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it('không phân giải đích loopback thành webhook public', async () => {
    await expect(resolveWebhookTarget('127.0.0.1')).rejects.toThrow('non-public address');
  });
});
