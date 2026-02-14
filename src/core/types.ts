export const STORAGE_KEY = 'chaos-core:v1';
export const STORAGE_SCHEMA_VERSION = 2;

export type StatKey = 'strength' | 'intelligence' | 'wisdom' | 'dexterity';
export type PathKey = 'warrior' | 'mage' | 'rogue' | 'priest';

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

export interface OnboardingState {
  completedAt?: string;
  version: number;
}

export interface ProfileState {
  path?: PathKey;
  focusStat?: StatKey;
}

export interface HistoryEntry {
  id: string;
  kind: 'check-in' | 'quest' | 'system';
  note: string;
  atISO: string;
}

export interface CoreDataV2 {
  schemaVersion: 2;
  xp: number;
  stats: Stats;
  lastCheckInISO: string | null;
  settings: Settings;
  onboarding: OnboardingState;
  profile: ProfileState;
  history: HistoryEntry[];
}
