import { ComponentType } from 'react';
import { TranslationKey } from '../shared/i18n';

export interface ContainerManifest {
  id: string;
  route: string;
  titleKey: TranslationKey;
  component: ComponentType;
  showInNav?: boolean;
}
