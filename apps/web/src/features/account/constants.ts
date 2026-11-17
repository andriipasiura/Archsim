import type { OAuthProviderId } from '@sds/shared';

export const API_BASE = '/api';

export const signInUrl = (provider: OAuthProviderId) =>
  `${API_BASE}/auth/${provider}`;

export const PROVIDER_LABELS: Record<OAuthProviderId, string> = {
  github: 'GitHub',
  google: 'Google',
};

export const STORAGE_KEYS = {
  link: 'archsim:cloud-link',
  saveAfterSignIn: 'archsim:save-after-sign-in',
} as const;

export const AUTH_ERROR_PARAM = 'auth_error';

export const DEFAULT_DIAGRAM_NAME = 'Untitled diagram';
