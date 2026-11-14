import { BLOCK_TYPES } from '@sds/shared';
import { describe, expect, it } from 'vitest';
import { BLOCK_GROUPS } from './block-meta';

describe('BLOCK_GROUPS', () => {
  it('lists every block type exactly once', () => {
    const grouped = BLOCK_GROUPS.flatMap((g) => g.types);
    expect([...grouped].sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it('has unique group ids', () => {
    const ids = BLOCK_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
