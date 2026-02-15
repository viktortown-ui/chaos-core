import { ContainerManifest } from './types';
import { coreManifest } from './core/manifest';
import { profileManifest } from './profile/manifest';
import { questsManifest } from './quests/manifest';
import { settingsManifest } from './settings/manifest';
import { onboardingManifest } from './onboarding/manifest';
import { glossaryManifest } from './glossary/manifest';
import { simulationManifest } from './sim/manifest';

export const containerRegistry: ContainerManifest[] = [
  coreManifest,
  questsManifest,
  profileManifest,
  simulationManifest,
  settingsManifest,
  onboardingManifest,
  glossaryManifest
];
