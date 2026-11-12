export const SOCIAL_PROVIDERS = ['GOOGLE', 'FACEBOOK', 'APPLE', 'ZALO', 'GITHUB'] as const;

export type SocialProviderName = (typeof SOCIAL_PROVIDERS)[number];

export interface SocialCredential {
  credential: string;
  redirectUri?: string;
}

export interface SocialProfile {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

export class SocialCredentialRejected extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SocialCredentialRejected';
  }
}

export interface SocialProviderAdapter {
  readonly name: SocialProviderName;
  isEnabled(): boolean;
  verify(input: SocialCredential): Promise<SocialProfile>;
}
