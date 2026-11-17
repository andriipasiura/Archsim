import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { parseCookie } from 'cookie';
import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'sid';
export const OAUTH_STATE_COOKIE = 'oauth_state';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function readCookie(
  req: Pick<IncomingMessage, 'headers'>,
  name: string,
): string | undefined {
  const header = req.headers.cookie;
  return header ? parseCookie(header)[name] : undefined;
}

export function cookieOptions(secure: boolean, maxAge?: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
