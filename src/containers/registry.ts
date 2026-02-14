import { ContainerManifest } from './types';
import { coreManifest } from './core/manifest';
import { profileManifest } from './profile/manifest';
import { questsManifest } from './quests/manifest';
import { settingsManifest } from './settings/manifest';

export const containerRegistry: ContainerManifest[] = [
  coreManifest,
  questsManifest,
  profileManifest,
  settingsManifest
];
