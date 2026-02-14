import { ContainerManifest } from '../types';
import { GlossaryScreen } from './ui/GlossaryScreen';

export const glossaryManifest: ContainerManifest = {
  id: 'glossary',
  route: '/glossary',
  title: 'Glossary',
  component: GlossaryScreen,
  showInNav: false
};
