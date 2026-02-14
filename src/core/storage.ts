import { CoreDataV1, STORAGE_KEY, STORAGE_SCHEMA_VERSION, StatKey } from './types';

export const defaultCoreData: CoreDataV1 = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  xp: 0,
  stats: {
    strength: 0,
    intelligence: 0,
    wisdom: 0,
    dexterity: 0
  },
  lastCheckInISO: null,
  settings: {
    reduceMotionOverride: null,
    soundFxEnabled: false
  }
};

export function loadCoreData(): CoreDataV1 {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultCoreData;

  try {
    const parsed = JSON.parse(raw) as Partial<CoreDataV1>;
    if (parsed.schemaVersion !== STORAGE_SCHEMA_VERSION) {
      return defaultCoreData;
    }

    return {
      ...defaultCoreData,
      ...parsed,
      stats: {
        ...defaultCoreData.stats,
        ...parsed.stats
      },
      settings: {
        ...defaultCoreData.settings,
        ...parsed.settings
      }
    } as CoreDataV1;
  } catch {
    return defaultCoreData;
  }
}

export function saveCoreData(data: CoreDataV1): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function canCheckInToday(lastCheckInISO: string | null, now = new Date()): boolean {
  if (!lastCheckInISO) return true;
  const last = new Date(lastCheckInISO);
  return now.toDateString() !== last.toDateString();
}

export function applyDailyCheckIn(data: CoreDataV1, stat: StatKey, now = new Date()): CoreDataV1 {
  return {
    ...data,
    xp: data.xp + 10,
    stats: {
      ...data.stats,
      [stat]: Math.min(100, data.stats[stat] + 1)
    },
    lastCheckInISO: now.toISOString()
  };
}
