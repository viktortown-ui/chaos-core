import { describe, expect, it } from 'vitest';
import { xpToLevel } from './formulas';

describe('xpToLevel', () => {
  it('returns level 1 for zero xp', () => {
    expect(xpToLevel(0)).toBe(1);
  });

  it('grows with sqrt progression', () => {
    expect(xpToLevel(25)).toBe(2);
    expect(xpToLevel(100)).toBe(3);
    expect(xpToLevel(225)).toBe(4);
  });
});
