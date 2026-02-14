import { ComponentType } from 'react';

export interface ContainerManifest {
  id: string;
  route: string;
  title: string;
  component: ComponentType;
  showInNav?: boolean;
}
