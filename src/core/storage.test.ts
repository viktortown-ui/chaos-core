import { describe, expect, it, beforeEach } from 'vitest';
import { defaultCoreData, loadCoreData, saveCoreData } from './storage';
import { STORAGE_KEY } from './types';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads data from localStorage', () => {
    const input = { ...defaultCoreData, xp: 42 };
    saveCoreData(input);
    expect(loadCoreData().xp).toBe(42);
  });

  it('falls back to defaults on schema mismatch', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 999, xp: 200 }));
    expect(loadCoreData().xp).toBe(0);
  });
});
