import { SimConfigPayload } from '../../features/sim/worker/protocol';
import { SimulationResult } from '../../core/sim/types';

const TEMPLATE_KEY = 'chaos-core:sim-templates:v1';
const BASELINE_KEY = 'chaos-core:sim-baseline:v1';

export interface SimTemplate {
  id: string;
  name: string;
  config: Partial<SimConfigPayload>;
  savedAtISO: string;
}

export interface SimBaseline {
  label: string;
  result: Pick<SimulationResult, 'scoreTrajectory' | 'horizonMonths' | 'runs'>;
  savedAtISO: string;
}

export function loadSimTemplates(): SimTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSimTemplate(template: SimTemplate): void {
  const all = loadSimTemplates();
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify([template, ...all].slice(0, 12)));
}

export function clearSimTemplates(): void {
  localStorage.removeItem(TEMPLATE_KEY);
}

export function saveBaseline(payload: SimBaseline): void {
  localStorage.setItem(BASELINE_KEY, JSON.stringify(payload));
}

export function loadBaseline(): SimBaseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SimBaseline;
  } catch {
    return null;
  }
}
