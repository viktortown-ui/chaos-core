import { ContainerManifest } from '../types';
import { ProfileScreen } from './ui/ProfileScreen';

export const profileManifest: ContainerManifest = {
  id: 'profile',
  route: '/profile',
  title: 'Profile',
  component: ProfileScreen
};
