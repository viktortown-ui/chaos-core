import { ContainerManifest } from '../types';
import { SimulationScreen } from './ui/SimulationScreen';

export const simulationManifest: ContainerManifest = {
  id: 'simulation',
  route: '/simulation',
  titleKey: 'navSimulation',
  component: SimulationScreen
};
