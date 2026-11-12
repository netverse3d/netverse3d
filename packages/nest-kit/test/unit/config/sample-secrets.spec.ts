import { sampleSecretNames } from '../../../src/config/sample-secrets';

describe('nhận ra khoá mẫu', () => {
  it.each([
    'changeme',
    'change-me-local-only',
    'change-me-admin-password',
    'local-development-otp-hash-secret-value',
    'dev-secret-key',
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
  ])('%s là khoá mẫu', (value) => {
    expect(sampleSecretNames({ SECRET: value }, ['SECRET'])).toEqual(['SECRET']);
  });

  it('khoá ngẫu nhiên không bị coi là khoá mẫu', () => {
    const env = { SECRET: '9f'.repeat(32) };
    expect(sampleSecretNames(env, ['SECRET'])).toEqual([]);
  });

  it('biến không đặt giá trị thì bỏ qua, và chỉ xét các biến được nêu tên', () => {
    const env = { OTHER: 'changeme', SECRET: undefined };
    expect(sampleSecretNames(env, ['SECRET'])).toEqual([]);
  });
});
