import { ConnectionMonitor } from '../../../../src/infrastructure/kafka/connection-monitor';

const INTERVAL_MS = 10_000;

describe('theo dõi kết nối tới broker', () => {
  let reachable: boolean;
  let probes: number;
  let monitor: ConnectionMonitor;

  beforeEach(() => {
    jest.useFakeTimers();
    reachable = true;
    probes = 0;
    monitor = new ConnectionMonitor(() => {
      probes += 1;
      return reachable ? Promise.resolve() : Promise.reject(new Error('broker is unreachable'));
    }, INTERVAL_MS);
  });

  afterEach(() => {
    monitor.stop();
    jest.useRealTimers();
  });

  const nextProbe = () => jest.advanceTimersByTimeAsync(INTERVAL_MS);

  it('chưa bắt đầu thì chưa được coi là có kết nối', () => {
    expect(monitor.isConnected()).toBe(false);
  });

  it('bắt đầu sau lúc đã nối được thì báo có kết nối ngay, chưa cần thăm dò', () => {
    monitor.start();
    expect(monitor.isConnected()).toBe(true);
    expect(probes).toBe(0);
  });

  it('broker không trả lời thì báo mất kết nối, trả lời lại thì báo có kết nối', async () => {
    monitor.start();
    reachable = false;
    await nextProbe();
    expect(monitor.isConnected()).toBe(false);

    reachable = true;
    await nextProbe();
    expect(monitor.isConnected()).toBe(true);
  });

  it('lần thăm dò trước chưa xong thì không chồng thêm lần mới', async () => {
    let release: () => void = () => undefined;
    const slow = new ConnectionMonitor(() => {
      probes += 1;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    }, INTERVAL_MS);
    slow.start();
    await nextProbe();
    await nextProbe();
    await nextProbe();
    expect(probes).toBe(1);
    release();
    await nextProbe();
    expect(probes).toBe(2);
    slow.stop();
  });

  it('dừng rồi thì thôi thăm dò và báo không còn kết nối', async () => {
    monitor.start();
    monitor.stop();
    await nextProbe();
    await nextProbe();
    expect(probes).toBe(0);
    expect(monitor.isConnected()).toBe(false);
  });
});
