import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, isBlockType } from './block-type.js';

describe('isBlockType', () => {
  it('accepts every known block type', () => {
    for (const type of BLOCK_TYPES) expect(isBlockType(type)).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isBlockType('mongodb')).toBe(false);
    expect(isBlockType(42)).toBe(false);
  });
});
