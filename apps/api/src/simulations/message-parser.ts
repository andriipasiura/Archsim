import { simClientMessageSchema } from '@sds/shared';
import { z } from 'zod';

export const INVALID_MESSAGE = 'invalid';

type WsData = string | Buffer | ArrayBuffer | Buffer[];

function text(data: WsData): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

export function parseClientMessage(data: WsData): {
  event: string;
  data: unknown;
} {
  let json: unknown;
  try {
    json = JSON.parse(text(data));
  } catch {
    return { event: INVALID_MESSAGE, data: 'Malformed JSON' };
  }
  const result = simClientMessageSchema.safeParse(json);
  return result.success
    ? { event: result.data.type, data: result.data }
    : { event: INVALID_MESSAGE, data: z.prettifyError(result.error) };
}
