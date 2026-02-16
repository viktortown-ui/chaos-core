import { SimConfigPayload } from '../../features/sim/worker/protocol';
import { SimulationResult } from '../../core/sim/types';

const TEMPLATE_KEY = 'chaos-core:sim-templates:v2';
const BASELINE_KEY = 'chaos-core:sim-baseline:v1';
const CUSTOM_OBJECTIVES_KEY = 'chaos-core:sim-custom-objectives:v1';

export interface CustomObjectivePayload {
  id: string;
  title_ru: string;
  title_en: string;
  domainTags: string[];
  description_ru: string;
  description_en: string;
  kpiSchema: Array<{
    id: 'successChance' | 'headroom' | 'badOutcome' | 'typicalOutcome' | 'goodOutcome' | 'failureWindow';
    label_ru: string;
    label_en: string;
    unit: '%' | 'months' | 'score' | 'money';
    help_ru: string;
    help_en: string;
    tier: 'basic' | 'advanced';
  }>;
  defaultConfigPatch: Partial<SimConfigPayload>;
  successCriterion: {
    kind: 'finalIndexGte' | 'runwayGte';
    value: number;
    unitLabel_ru: string;
    unitLabel_en: string;
  };
  levers: Array<{
    id: string;
    title_ru: string;
    title_en: string;
    costHint_ru: string;
    costHint_en: string;
  }>;
}

export interface SimTemplate {
  id: string;
  name: string;
  config: Partial<SimConfigPayload>;
  savedAtISO: string;
  objectiveId?: string;
  customObjective?: CustomObjectivePayload;
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

export function saveCustomObjective(objective: CustomObjectivePayload): void {
  const all = loadCustomObjectives();
  const deduped = [objective, ...all.filter((item) => item.id !== objective.id)];
  localStorage.setItem(CUSTOM_OBJECTIVES_KEY, JSON.stringify(deduped.slice(0, 8)));
}

export function loadCustomObjectives(): CustomObjectivePayload[] {
  try {
    const raw = localStorage.getItem(CUSTOM_OBJECTIVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
