const REFRESH_MARGIN_MS = 60_000;
const DEFAULT_LIFETIME_SECONDS = 3_000;

export interface AccessToken {
  value: string;
  expiresAt: number;
}

export function accessTokenFrom(body: { access_token?: string; expires_in?: number }): AccessToken {
  if (!body.access_token) {
    throw new Error('The token endpoint answered without an access token');
  }
  const lifetimeSeconds =
    typeof body.expires_in === 'number' && body.expires_in > 0
      ? body.expires_in
      : DEFAULT_LIFETIME_SECONDS;
  return { value: body.access_token, expiresAt: Date.now() + lifetimeSeconds * 1000 };
}

export class AccessTokenCache {
  private token: AccessToken | null = null;
  private refreshing: Promise<AccessToken> | null = null;

  constructor(private readonly issue: () => Promise<AccessToken>) {}

  async get(): Promise<string> {
    if (this.token && this.token.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
      return this.token.value;
    }
    this.refreshing ??= this.issue().then(
      (token) => {
        this.token = token;
        this.refreshing = null;
        return token;
      },
      (error: unknown) => {
        this.refreshing = null;
        throw error;
      },
    );
    return (await this.refreshing).value;
  }

  discard(value: string): void {
    if (this.token?.value === value) {
      this.token = null;
    }
  }
}
