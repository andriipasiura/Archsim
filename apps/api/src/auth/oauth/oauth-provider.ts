import type { OAuthProviderId } from '@sds/shared';

export interface OAuthProfile {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface OAuthProvider {
  readonly id: OAuthProviderId;
  authorizeUrl(state: string): string;
  fetchProfile(code: string): Promise<OAuthProfile>;
}
