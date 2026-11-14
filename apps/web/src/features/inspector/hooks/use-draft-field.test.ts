import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../messages';
import { validateNumber } from './use-draft-field';

const replicas = { min: 1, max: 1000, integer: true };
const latency = { min: 0, max: undefined, integer: false };

describe('validateNumber', () => {
  it('accepts values within the rules', () => {
    expect(validateNumber('3', replicas)).toBeNull();
    expect(validateNumber('2.5', latency)).toBeNull();
    expect(validateNumber('0', latency)).toBeNull();
  });

  it('rejects empty and non-numeric input', () => {
    expect(validateNumber('', replicas)).toBe(MESSAGES.numberRequired);
    expect(validateNumber('abc', replicas)).toBe(MESSAGES.numberRequired);
  });

  it('enforces integers and bounds', () => {
    expect(validateNumber('1.5', replicas)).toBe(MESSAGES.integerRequired);
    expect(validateNumber('0', replicas)).toBe(MESSAGES.minimum(1));
    expect(validateNumber('1001', replicas)).toBe(MESSAGES.maximum(1000));
  });
});
