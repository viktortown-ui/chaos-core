export const STORAGE_KEY = 'chaos-core:v1';
export const STORAGE_SCHEMA_VERSION = 1;

export type StatKey = 'strength' | 'intelligence' | 'wisdom' | 'dexterity';

export interface Stats {
  strength: number;
  intelligence: number;
  wisdom: number;
  dexterity: number;
}

export interface Settings {
  reduceMotionOverride: boolean | null;
  soundFxEnabled: boolean;
}

export interface CoreDataV1 {
  schemaVersion: 1;
  xp: number;
  stats: Stats;
  lastCheckInISO: string | null;
  settings: Settings;
}
