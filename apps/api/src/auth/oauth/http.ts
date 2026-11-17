import type { z } from 'zod';

const REQUEST_TIMEOUT_MS = 10_000;

export async function fetchJson<T extends z.ZodType>(
  url: string,
  init: RequestInit,
  schema: T,
): Promise<z.infer<T>> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} responded with HTTP ${res.status}`);
  return schema.parse(await res.json());
}

export function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  url.search = new URLSearchParams(params).toString();
  return url.toString();
}
