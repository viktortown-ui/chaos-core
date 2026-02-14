import { ContainerManifest } from '../types';
import { GlossaryScreen } from './ui/GlossaryScreen';

export const glossaryManifest: ContainerManifest = {
  id: 'glossary',
  route: '/glossary',
  titleKey: 'navGlossary',
  component: GlossaryScreen,
  showInNav: false
};
