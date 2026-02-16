import { StateVector, StrategyMode } from '../../../core/sim/types';
import { SimConfigPayload } from '../worker/protocol';

export type ObjectiveKpiTier = 'basic' | 'advanced';

export interface ObjectiveKpiSchemaItem {
  id: 'successChance' | 'headroom' | 'badOutcome' | 'typicalOutcome' | 'goodOutcome' | 'failureWindow';
  label_ru: string;
  label_en: string;
  unit: '%' | 'months' | 'score' | 'money';
  help_ru: string;
  help_en: string;
  tier: ObjectiveKpiTier;
}

export interface ObjectiveSuccessCriterion {
  kind: 'finalIndexGte' | 'runwayGte';
  value: number;
  unitLabel_ru: string;
  unitLabel_en: string;
}

export interface ObjectiveLever {
  id: string;
  title_ru: string;
  title_en: string;
  costHint_ru: string;
  costHint_en: string;
  patchFn: (config: SimConfigPayload, baseState: StateVector) => {
    configPatch: Partial<SimConfigPayload>;
    baseStatePatch?: Partial<StateVector>;
  };
}

export interface ObjectiveTemplate {
  id: string;
  title_ru: string;
  title_en: string;
  domainTags: string[];
  description_ru: string;
  description_en: string;
  kpiSchema: ObjectiveKpiSchemaItem[];
  defaultConfigPatch: Partial<SimConfigPayload>;
  successCriterion: ObjectiveSuccessCriterion;
  levers: ObjectiveLever[];
}

const defaultKpiSchema = (headroomLabelRu: string, headroomLabelEn: string, headroomUnit: ObjectiveKpiSchemaItem['unit']): ObjectiveKpiSchemaItem[] => [
  { id: 'successChance', label_ru: 'Шанс успеха', label_en: 'Success chance', unit: '%', help_ru: 'Доля миров, где критерий миссии выполнен к горизонту.', help_en: 'Share of worlds where the mission criterion passes by horizon.', tier: 'basic' },
  { id: 'headroom', label_ru: headroomLabelRu, label_en: headroomLabelEn, unit: headroomUnit, help_ru: 'Насколько медианный исход выше или ниже порога успеха.', help_en: 'How far the median sits above or below the success threshold.', tier: 'basic' },
  { id: 'badOutcome', label_ru: 'Плохой исход', label_en: 'Bad outcome', unit: 'score', help_ru: 'Нижние 10% исходов. Нужен для честной оценки риска.', help_en: 'Worst 10% outcomes for downside awareness.', tier: 'basic' },
  { id: 'typicalOutcome', label_ru: 'Обычный исход', label_en: 'Typical outcome', unit: 'score', help_ru: 'Медиана: что будет чаще всего при текущем плане.', help_en: 'Median: what most likely happens under current plan.', tier: 'basic' },
  { id: 'goodOutcome', label_ru: 'Хороший исход', label_en: 'Good outcome', unit: 'score', help_ru: 'Лучшие 10% исходов при благоприятном стечении факторов.', help_en: 'Best 10% outcomes under favorable conditions.', tier: 'basic' },
  { id: 'failureWindow', label_ru: 'Где ломается чаще', label_en: 'Most fragile window', unit: 'months', help_ru: 'Диапазон месяцев, где медиана уходит ниже порога.', help_en: 'Months range where median falls below threshold.', tier: 'basic' }
];

const noObjectiveLevers: ObjectiveLever[] = [
  { id: 'trim-cost', title_ru: 'Дешевле: убрать лишние расходы', title_en: 'Cheaper: trim costs', costHint_ru: 'Снижает порог входа', costHint_en: 'Lowers required threshold', patchFn: (config) => ({ configPatch: { successThreshold: Math.max(80, config.successThreshold - 4) } }) },
  { id: 'short-loop', title_ru: 'Быстрее: короткий цикл проверки', title_en: 'Faster: shorten validation loop', costHint_ru: 'Быстрее получаешь обратную связь', costHint_en: 'Get feedback sooner', patchFn: (config) => ({ configPatch: { horizonMonths: Math.max(6, config.horizonMonths - 2) } }) },
  { id: 'hedge', title_ru: 'Безопаснее: страхующий сценарий', title_en: 'Safer: hedge scenario', costHint_ru: 'Снижает риск хвоста', costHint_en: 'Reduces tail risk', patchFn: (config) => ({ configPatch: { blackSwanEnabled: true, riskAppetite: Math.max(0.2, config.riskAppetite - 0.1) } }) }
];

export const builtInObjectives: ObjectiveTemplate[] = [
  { id: 'layoff', title_ru: 'Увольнение', title_en: 'Layoff', domainTags: ['finance', 'stability'], description_ru: 'Проверяем, переживёшь ли потерю дохода без провала.', description_en: 'Stress-test survival during income loss.', kpiSchema: defaultKpiSchema('Запас прочности (мес)', 'Runway buffer (months)', 'months'), defaultConfigPatch: { horizonMonths: 12, uncertainty: 0.75, riskAppetite: 0.25, strategy: 'defense', blackSwanEnabled: true, successThreshold: 108 }, successCriterion: { kind: 'runwayGte', value: 6, unitLabel_ru: 'мес', unitLabel_en: 'months' }, levers: noObjectiveLevers },
  { id: 'mortgage', title_ru: 'Ипотека', title_en: 'Mortgage', domainTags: ['finance', 'long-term'], description_ru: 'Смотрим, выдержит ли план выплат долгий горизонт.', description_en: 'Check if long payment plan remains durable.', kpiSchema: defaultKpiSchema('Запас прочности (₽)', 'Buffer (₽)', 'money'), defaultConfigPatch: { horizonMonths: 24, uncertainty: 0.45, riskAppetite: 0.3, strategy: 'balance', blackSwanEnabled: true, successThreshold: 118 }, successCriterion: { kind: 'finalIndexGte', value: 118, unitLabel_ru: '₽', unitLabel_en: '₽' }, levers: noObjectiveLevers },
  { id: 'deal', title_ru: 'Сделка', title_en: 'Deal', domainTags: ['career', 'growth'], description_ru: 'Оцениваем вероятность закрыть сделку без критичной просадки.', description_en: 'Estimate chance to close deal without severe downside.', kpiSchema: defaultKpiSchema('Запас прочности (пункты)', 'Buffer (points)', 'score'), defaultConfigPatch: { horizonMonths: 9, uncertainty: 0.65, riskAppetite: 0.8, strategy: 'attack', blackSwanEnabled: true, successThreshold: 138 }, successCriterion: { kind: 'finalIndexGte', value: 138, unitLabel_ru: 'пунктов', unitLabel_en: 'points' }, levers: noObjectiveLevers },
  { id: 'wedding', title_ru: 'Свадьба', title_en: 'Wedding', domainTags: ['family', 'events'], description_ru: 'Планируем бюджет и стресс до события без срывов.', description_en: 'Plan budget and stress around event delivery.', kpiSchema: defaultKpiSchema('Запас прочности (₽)', 'Buffer (₽)', 'money'), defaultConfigPatch: { horizonMonths: 18, uncertainty: 0.4, riskAppetite: 0.35, strategy: 'balance', blackSwanEnabled: false, successThreshold: 122 }, successCriterion: { kind: 'finalIndexGte', value: 122, unitLabel_ru: '₽', unitLabel_en: '₽' }, levers: noObjectiveLevers },
  { id: 'relocation', title_ru: 'Переезд', title_en: 'Relocation', domainTags: ['life', 'mobility'], description_ru: 'Проверяем устойчивость плана переезда в новой среде.', description_en: 'Check relocation plan resilience in new environment.', kpiSchema: defaultKpiSchema('Запас прочности (мес)', 'Buffer (months)', 'months'), defaultConfigPatch: { horizonMonths: 16, uncertainty: 0.7, riskAppetite: 0.45, strategy: 'balance', blackSwanEnabled: true, successThreshold: 120 }, successCriterion: { kind: 'runwayGte', value: 4, unitLabel_ru: 'мес', unitLabel_en: 'months' }, levers: noObjectiveLevers }
];

export function getObjectiveById(id: string): ObjectiveTemplate | null {
  return builtInObjectives.find((objective) => objective.id === id) ?? null;
}

export function buildCustomObjective(title: string): ObjectiveTemplate {
  return {
    id: `custom-${Date.now()}`,
    title_ru: title,
    title_en: title,
    domainTags: ['custom'],
    description_ru: 'Пользовательская миссия.',
    description_en: 'Custom user mission.',
    kpiSchema: defaultKpiSchema('Запас прочности (пункты)', 'Buffer (points)', 'score'),
    defaultConfigPatch: { horizonMonths: 12, uncertainty: 0.5, riskAppetite: 0.5, strategy: 'balance', blackSwanEnabled: true, successThreshold: 120 },
    successCriterion: { kind: 'finalIndexGte', value: 120, unitLabel_ru: 'пунктов', unitLabel_en: 'points' },
    levers: noObjectiveLevers
  };
}

export function strategyLabel(strategy: StrategyMode): 'strategyAttack' | 'strategyBalance' | 'strategyDefense' {
  if (strategy === 'attack') return 'strategyAttack';
  if (strategy === 'defense') return 'strategyDefense';
  return 'strategyBalance';
}
