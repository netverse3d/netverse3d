import { AccessTokenCache } from '../../../../../src/modules/channels/adapters/access-token-cache';

const HOUR_MS = 3_600_000;

describe('bộ đệm access token của nhà cung cấp', () => {
  let now: number;
  let issued: number;
  let cache: AccessTokenCache;
  let failNext: boolean;

  beforeEach(() => {
    now = 1_800_000_000_000;
    issued = 0;
    failNext = false;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    cache = new AccessTokenCache(async () => {
      await new Promise((resolve) => setImmediate(resolve));
      if (failNext) {
        failNext = false;
        throw new Error('token endpoint answered 500');
      }
      issued += 1;
      return { value: `token-${issued}`, expiresAt: now + HOUR_MS };
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('nhiều lần hỏi cùng lúc chỉ xin token một lần và dùng lại tới lúc gần hết hạn', async () => {
    await expect(Promise.all([cache.get(), cache.get(), cache.get()])).resolves.toEqual([
      'token-1',
      'token-1',
      'token-1',
    ]);
    now += HOUR_MS - 120_000;
    await expect(cache.get()).resolves.toBe('token-1');
    expect(issued).toBe(1);
  });

  it('token gần hết hạn thì các lần hỏi cùng lúc chỉ xin mới một lần', async () => {
    await cache.get();
    now += HOUR_MS - 30_000;
    await expect(Promise.all([cache.get(), cache.get(), cache.get()])).resolves.toEqual([
      'token-2',
      'token-2',
      'token-2',
    ]);
    expect(issued).toBe(2);
  });

  it('xin token lỗi thì mọi lần hỏi đang chờ cùng lỗi, lần sau xin lại', async () => {
    failNext = true;
    const waiting = await Promise.allSettled([cache.get(), cache.get()]);
    expect(waiting.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    await expect(cache.get()).resolves.toBe('token-1');
  });

  it('chỉ bỏ token bị từ chối, không bỏ token mới hơn', async () => {
    const rejected = await cache.get();
    cache.discard(rejected);
    await expect(cache.get()).resolves.toBe('token-2');
    cache.discard(rejected);
    await expect(cache.get()).resolves.toBe('token-2');
    expect(issued).toBe(2);
  });
});
