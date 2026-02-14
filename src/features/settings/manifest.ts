import { ContainerManifest } from '../types';
import { SettingsScreen } from './ui/SettingsScreen';

export const settingsManifest: ContainerManifest = {
  id: 'settings',
  route: '/settings',
  titleKey: 'navSettings',
  component: SettingsScreen
};
