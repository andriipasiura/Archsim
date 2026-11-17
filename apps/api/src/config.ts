import { existsSync } from 'node:fs';
import type { OAuthProviderId } from '@sds/shared';
import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.url(),
  WEB_URL: z.url().default('http://localhost:5173'),
  COOKIE_SECURE: z.stringbool().default(false),
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  GITHUB_CALLBACK_URL: optionalString.pipe(z.url().optional()),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: optionalString.pipe(z.url().optional()),
});

export interface OAuthAppConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  webUrl: string;
  cookieSecure: boolean;
  oauth: Record<OAuthProviderId, OAuthAppConfig | null>;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

function oauthApp(
  clientId: string | undefined,
  clientSecret: string | undefined,
  callbackUrl: string | undefined,
): OAuthAppConfig | null {
  return clientId && clientSecret && callbackUrl
    ? { clientId, clientSecret, callbackUrl }
    : null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  const e = result.data;
  return {
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    webUrl: e.WEB_URL,
    cookieSecure: e.COOKIE_SECURE,
    oauth: {
      github: oauthApp(
        e.GITHUB_CLIENT_ID,
        e.GITHUB_CLIENT_SECRET,
        e.GITHUB_CALLBACK_URL,
      ),
      google: oauthApp(
        e.GOOGLE_CLIENT_ID,
        e.GOOGLE_CLIENT_SECRET,
        e.GOOGLE_CALLBACK_URL,
      ),
    },
  };
}

export function loadRootEnvFile(): void {
  const file = new URL('../../../.env', import.meta.url);
  if (existsSync(file)) process.loadEnvFile(file);
}
