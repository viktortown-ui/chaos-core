import { ContainerManifest } from '../types';
import { QuestsScreen } from './ui/QuestsScreen';

export const questsManifest: ContainerManifest = {
  id: 'quests',
  route: '/quests',
  titleKey: 'navQuests',
  component: QuestsScreen
};
