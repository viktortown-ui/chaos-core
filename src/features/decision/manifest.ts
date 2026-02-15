import { ContainerManifest } from '../types';
import { DecisionScreen } from './ui/DecisionScreen';

export const decisionManifest: ContainerManifest = {
  id: 'decision',
  route: '/oracle',
  titleKey: 'navDecision',
  component: DecisionScreen
};
