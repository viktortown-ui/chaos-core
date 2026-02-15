import { ContainerManifest } from '../types';
import { HistoryScreen } from './ui/HistoryScreen';

export const historyManifest: ContainerManifest = {
  id: 'history',
  route: '/history',
  titleKey: 'navHistory',
  component: HistoryScreen
};
