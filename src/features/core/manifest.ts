import { ContainerManifest } from '../types';
import { CoreScreen } from './ui/CoreScreen';

export const coreManifest: ContainerManifest = {
  id: 'core',
  route: '/',
  title: 'Core',
  component: CoreScreen
};
