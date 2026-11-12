export const BLOCK_TYPES = [
  'load-balancer',
  'service',
  'postgres',
  'redis',
  'queue',
  'cdn',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export function isBlockType(value: unknown): value is BlockType {
  return (BLOCK_TYPES as readonly unknown[]).includes(value);
}
