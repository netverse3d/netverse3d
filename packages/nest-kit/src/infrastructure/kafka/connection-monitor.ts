export class ConnectionMonitor {
  private connected = false;
  private probing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly probe: () => Promise<unknown>,
    private readonly intervalMs: number,
  ) {}

  start(): void {
    this.connected = true;
    this.timer = setInterval(() => void this.check(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async check(): Promise<void> {
    if (this.probing) {
      return;
    }
    this.probing = true;
    const reachable = await this.probe().then(
      () => true,
      () => false,
    );
    this.probing = false;
    if (this.timer) {
      this.connected = reachable;
    }
  }
}
