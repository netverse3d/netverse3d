import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { AppConfig } from '../../../config/app-config';
import { fetchProviderJson } from './social-http';
import {
  SocialCredential,
  SocialCredentialRejected,
  SocialProfile,
  SocialProviderAdapter,
} from './social-provider';

interface FacebookDebugToken {
  data?: { is_valid?: boolean; app_id?: string; user_id?: string };
}

interface FacebookProfile {
  id?: string;
  name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
}

@Injectable()
export class FacebookProvider implements SocialProviderAdapter {
  readonly name = 'FACEBOOK' as const;

  constructor(private readonly config: AppConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.social.facebook.appId && this.config.social.facebook.appSecret);
  }

  async verify({ credential }: SocialCredential): Promise<SocialProfile> {
    const { appId, appSecret, graphUrl } = this.config.social.facebook;
    const debugParams = new URLSearchParams({
      input_token: credential,
      access_token: `${appId}|${appSecret}`,
    });
    const debug = await fetchProviderJson<FacebookDebugToken>(
      `${graphUrl}/debug_token?${debugParams}`,
    );
    if (!debug.ok || !debug.body.data?.is_valid || debug.body.data.app_id !== appId) {
      throw new SocialCredentialRejected('token was not issued for this application');
    }

    const profileParams = new URLSearchParams({
      fields: 'id,name,email,picture',
      access_token: credential,
    });
    const profile = await fetchProviderJson<FacebookProfile>(`${graphUrl}/me?${profileParams}`);
    if (!profile.ok || !profile.body.id || profile.body.id !== debug.body.data.user_id) {
      throw new SocialCredentialRejected('profile does not match the verified token');
    }
    return {
      subject: profile.body.id,
      email: profile.body.email ?? null,
      emailVerified: Boolean(profile.body.email),
      displayName: profile.body.name ?? null,
      avatarUrl: profile.body.picture?.data?.url ?? null,
    };
  }
}

interface ZaloProfile {
  id?: string;
  name?: string;
  picture?: { data?: { url?: string } };
  error?: number;
}

@Injectable()
export class ZaloProvider implements SocialProviderAdapter {
  readonly name = 'ZALO' as const;

  constructor(private readonly config: AppConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.social.zalo.appSecret);
  }

  async verify({ credential }: SocialCredential): Promise<SocialProfile> {
    const { appSecret, graphUrl } = this.config.social.zalo;
    const proof = createHmac('sha256', appSecret as string)
      .update(credential)
      .digest('hex');
    const profile = await fetchProviderJson<ZaloProfile>(`${graphUrl}/me?fields=id,name,picture`, {
      headers: { access_token: credential, appsecret_proof: proof },
    });
    if (!profile.ok || profile.body.error || !profile.body.id) {
      throw new SocialCredentialRejected('zalo rejected the token');
    }
    return {
      subject: profile.body.id,
      email: null,
      emailVerified: false,
      displayName: profile.body.name ?? null,
      avatarUrl: profile.body.picture?.data?.url ?? null,
    };
  }
}

interface GithubToken {
  access_token?: string;
  error?: string;
}

interface GithubUser {
  id?: number;
  name?: string | null;
  login?: string;
  avatar_url?: string;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

@Injectable()
export class GithubProvider implements SocialProviderAdapter {
  readonly name = 'GITHUB' as const;

  constructor(private readonly config: AppConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.social.github.clientId && this.config.social.github.clientSecret);
  }

  async verify({ credential, redirectUri }: SocialCredential): Promise<SocialProfile> {
    const accessToken = await this.exchangeCode(credential, redirectUri);
    const { apiUrl } = this.config.social.github;
    const headers = {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'identity-service',
    };
    const user = await fetchProviderJson<GithubUser>(`${apiUrl}/user`, { headers });
    if (!user.ok || !user.body.id) {
      throw new SocialCredentialRejected('github rejected the token');
    }
    const emails = await fetchProviderJson<GithubEmail[]>(`${apiUrl}/user/emails`, { headers });
    const primary = emails.ok
      ? emails.body.find((email) => email.primary && email.verified)
      : undefined;
    return {
      subject: String(user.body.id),
      email: primary?.email ?? null,
      emailVerified: Boolean(primary),
      displayName: user.body.name ?? user.body.login ?? null,
      avatarUrl: user.body.avatar_url ?? null,
    };
  }

  private async exchangeCode(code: string, redirectUri: string | undefined): Promise<string> {
    const { clientId, clientSecret, oauthUrl } = this.config.social.github;
    const token = await fetchProviderJson<GithubToken>(oauthUrl, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!token.ok || !token.body.access_token) {
      throw new SocialCredentialRejected('github rejected the code');
    }
    return token.body.access_token;
  }
}
