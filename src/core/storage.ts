import { CoreDataV2, PathKey, STORAGE_KEY, STORAGE_SCHEMA_VERSION, StatKey } from './types';

export const defaultCoreData: CoreDataV2 = {
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
    soundFxEnabled: false,
    language: 'ru'
  },
  onboarding: {
    version: 1
  },
  profile: {},
  history: []
};

function migrateToV2(parsed: Partial<CoreDataV2>): CoreDataV2 {
  return {
    ...defaultCoreData,
    ...parsed,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    stats: {
      ...defaultCoreData.stats,
      ...parsed.stats
    },
    settings: {
      ...defaultCoreData.settings,
      ...parsed.settings
    },
    onboarding: {
      ...defaultCoreData.onboarding,
      ...parsed.onboarding
    },
    profile: {
      ...defaultCoreData.profile,
      ...parsed.profile
    },
    history: Array.isArray(parsed.history) ? parsed.history : []
  };
}

export function loadCoreData(): CoreDataV2 {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultCoreData;

  try {
    const parsed = JSON.parse(raw) as Partial<CoreDataV2>;

    if (parsed.schemaVersion === STORAGE_SCHEMA_VERSION || parsed.schemaVersion == null || parsed.schemaVersion === 1) {
      return migrateToV2(parsed);
    }

    return defaultCoreData;
  } catch {
    return defaultCoreData;
  }
}

export function saveCoreData(data: CoreDataV2): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function canCheckInToday(lastCheckInISO: string | null, now = new Date()): boolean {
  if (!lastCheckInISO) return true;
  const last = new Date(lastCheckInISO);
  return now.toDateString() !== last.toDateString();
}

export function applyDailyCheckIn(data: CoreDataV2, stat: StatKey, now = new Date()): CoreDataV2 {
  return {
    ...data,
    xp: data.xp + 10,
    stats: {
      ...data.stats,
      [stat]: Math.min(100, data.stats[stat] + 1)
    },
    lastCheckInISO: now.toISOString(),
    history: [
      {
        id: `check-in-${now.getTime()}`,
        kind: 'check-in',
        note: `Daily check-in: +1 ${stat}`,
        atISO: now.toISOString()
      },
      ...data.history
    ]
  };
}

export function buildDemoData(now = new Date()): CoreDataV2 {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const path: PathKey = 'warrior';
  const focusStat: StatKey = 'strength';

  return {
    ...defaultCoreData,
    xp: 120,
    stats: {
      strength: 8,
      intelligence: 4,
      wisdom: 3,
      dexterity: 5
    },
    lastCheckInISO: yesterday.toISOString(),
    onboarding: {
      completedAt: new Date('2026-01-01T09:00:00.000Z').toISOString(),
      version: 1
    },
    profile: {
      path,
      focusStat
    },
    history: [
      {
        id: 'demo-system-1',
        kind: 'system',
        note: 'Core initialized with demo profile.',
        atISO: new Date('2026-01-01T09:00:00.000Z').toISOString()
      },
      {
        id: 'demo-quest-1',
        kind: 'quest',
        note: 'Completed: Stabilize the Rift',
        atISO: new Date('2026-01-02T09:00:00.000Z').toISOString()
      },
      {
        id: 'demo-checkin-1',
        kind: 'check-in',
        note: 'Daily check-in: +1 strength',
        atISO: yesterday.toISOString()
      }
    ]
  };
}
