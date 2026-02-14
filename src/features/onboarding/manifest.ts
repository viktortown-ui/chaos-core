import { ContainerManifest } from '../types';
import { OnboardingScreen } from './ui/OnboardingScreen';

export const onboardingManifest: ContainerManifest = {
  id: 'onboarding',
  route: '/onboarding',
  title: 'Onboarding',
  component: OnboardingScreen,
  showInNav: false
};
