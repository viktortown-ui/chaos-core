import { beforeEach, describe, expect, it } from 'vitest';
import { applyDailyCheckIn, canCheckInToday, defaultCoreData, loadCoreData, saveCoreData } from './storage';
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
    expect(loadCoreData()).toEqual(defaultCoreData);
  });

  it('migrates schema-less payloads to current schema', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        xp: 50,
        stats: { strength: 3 },
        lastCheckInISO: null
      })
    );

    const migrated = loadCoreData();
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.xp).toBe(50);
    expect(migrated.stats.strength).toBe(3);
    expect(migrated.settings.soundFxEnabled).toBe(false);
  });
});

describe('daily check-in rules', () => {
  it('allows one check-in per day', () => {
    const morning = new Date('2025-01-10T09:00:00.000Z');
    const sameDay = new Date('2025-01-10T18:00:00.000Z');
    const nextDay = new Date('2025-01-11T09:00:00.000Z');

    expect(canCheckInToday(null, morning)).toBe(true);
    expect(canCheckInToday(morning.toISOString(), sameDay)).toBe(false);
    expect(canCheckInToday(morning.toISOString(), nextDay)).toBe(true);
  });

  it('applies +10 XP and +1 selected stat (up to 100)', () => {
    const checkedIn = applyDailyCheckIn(defaultCoreData, 'strength', new Date('2025-01-10T09:00:00.000Z'));
    expect(checkedIn.xp).toBe(10);
    expect(checkedIn.stats.strength).toBe(1);

    const nearCap = {
      ...defaultCoreData,
      stats: { ...defaultCoreData.stats, intelligence: 100 }
    };
    const capped = applyDailyCheckIn(nearCap, 'intelligence');
    expect(capped.stats.intelligence).toBe(100);
  });
});
