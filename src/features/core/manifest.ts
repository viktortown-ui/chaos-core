import { ContainerManifest } from '../types';
import { CoreScreen } from './ui/CoreScreen';

export const coreManifest: ContainerManifest = {
  id: 'core',
  route: '/',
  titleKey: 'navCore',
  component: CoreScreen
};
