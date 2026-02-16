import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { SimulationResult, StateVector, StrategyMode } from '../../../core/sim/types';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { Language, t } from '../../../shared/i18n';
import {
  CustomObjectivePayload,
  SimTemplate,
  loadCustomObjectives,
  loadSimTemplates,
  saveCustomObjective,
  saveSimTemplate
} from '../../../shared/storage/simStorage';
import {
  ObjectiveTemplate,
  buildCustomObjective,
  builtInObjectives,
  getObjectiveById,
  strategyLabel
} from '../objectives/objectivesCatalog';
import { SensitivityItem, SimConfigPayload, SimWorkerResponse } from '../worker/protocol';
import { buildDrivers, buildFanPoints, findFailureWindow, formatAdaptive, rankLevers } from './simulationViewModel';

const RUNS = 10_000;

function baseStateFromCore(data: ReturnType<typeof useChaosCore>['data']): StateVector {
  return {
    capital: Math.max(40, data.xp * 0.6),
    resilience: (data.stats.wisdom + data.stats.dexterity) * 2,
    momentum: (data.stats.strength + data.stats.intelligence) * 1.4,
    stress: Math.max(5, 30 - data.stats.wisdom)
  };
}

function kpiLabel(item: ObjectiveTemplate['kpiSchema'][number], language: Language) {
  return language === 'ru' ? item.label_ru : item.label_en;
}

function kpiHelp(item: ObjectiveTemplate['kpiSchema'][number], language: Language) {
  return language === 'ru' ? item.help_ru : item.help_en;
}

function missionTitle(item: { title_ru: string; title_en: string }, language: Language) {
  return language === 'ru' ? item.title_ru : item.title_en;
}


function toCustomObjectivePayload(template: ObjectiveTemplate): CustomObjectivePayload {
  return {
    id: template.id,
    title_ru: template.title_ru,
    title_en: template.title_en,
    domainTags: template.domainTags,
    description_ru: template.description_ru,
    description_en: template.description_en,
    kpiSchema: template.kpiSchema,
    defaultConfigPatch: template.defaultConfigPatch,
    successCriterion: template.successCriterion,
    levers: template.levers.map((lever) => ({
      id: lever.id,
      title_ru: lever.title_ru,
      title_en: lever.title_en,
      costHint_ru: lever.costHint_ru,
      costHint_en: lever.costHint_en
    }))
  };
}
function toObjectiveTemplate(payload: CustomObjectivePayload): ObjectiveTemplate {
  return {
    ...payload,
    levers: payload.levers.map((lever) => ({
      ...lever,
      patchFn: () => ({ configPatch: {} })
    }))
  };
}

function SimpleCorridorChart({ points, threshold, reducedMotion, language }: { points: ReturnType<typeof buildFanPoints>; threshold: number; reducedMotion: boolean; language: Language }) {
  if (points.length === 0) return null;
  const w = 760;
  const h = 260;
  const pad = 24;
  const values = points.flatMap((point) => [point.p10, point.p50, point.p90]);
  values.push(threshold);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const toX = (index: number) => pad + (index / Math.max(1, points.length - 1)) * (w - pad * 2);
  const toY = (value: number) => pad + (1 - (value - min) / span) * (h - pad * 2);
  const band = `${points.map((p, index) => `${toX(index)},${toY(p.p90)}`).join(' ')} ${points.slice().reverse().map((p, revIndex) => {
    const index = points.length - 1 - revIndex;
    return `${toX(index)},${toY(p.p10)}`;
  }).join(' ')}`;
  const median = points.map((p, index) => `${toX(index)},${toY(p.p50)}`).join(' ');
  const thresholdY = toY(threshold);

  return (
    <figure className={`sim-corridor-chart${reducedMotion ? ' reduce-motion' : ''}`}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t('simulationTrajectoryTitle', language)}>
        <polygon points={band} className="sim-corridor-chart__band" />
        <polyline points={median} className="sim-corridor-chart__median" />
        <line x1={pad} x2={w - pad} y1={thresholdY} y2={thresholdY} className="sim-corridor-chart__threshold" />
      </svg>
      <figcaption>{t('simulationChartCaption', language)}</figcaption>
    </figure>
  );
}

export function SimulationScreen() {
  const { data } = useChaosCore();
  const language = data.settings.language;
  const reducedMotion = useReducedMotion(data.settings.reduceMotionOverride);

  const [objectiveId, setObjectiveId] = useState('layoff');
  const [customObjectives, setCustomObjectives] = useState<CustomObjectivePayload[]>([]);

  const [horizonMonths, setHorizonMonths] = useState(12);
  const [riskAppetite, setRiskAppetite] = useState(0.5);
  const [uncertainty, setUncertainty] = useState(0.5);
  const [strategy, setStrategy] = useState<StrategyMode>('balance');
  const [blackSwanEnabled, setBlackSwanEnabled] = useState(true);
  const [successThreshold, setSuccessThreshold] = useState(120);

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityItem[]>([]);
  const [templates, setTemplates] = useState<SimTemplate[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [needsRecalc, setNeedsRecalc] = useState(true);

  const workerRef = useRef<Worker | null>(null);
  const activeRequestId = useRef<string | null>(null);
  const activeSensitivityId = useRef<string | null>(null);

  const selectedObjective = useMemo<ObjectiveTemplate>(() => {
    const builtIn = getObjectiveById(objectiveId);
    if (builtIn) return builtIn;
    const custom = customObjectives.find((item) => item.id === objectiveId);
    if (custom) return toObjectiveTemplate(custom);
    return builtInObjectives[0];
  }, [customObjectives, objectiveId]);

  const baseState = useMemo(() => baseStateFromCore(data), [data]);

  const buildConfig = (): SimConfigPayload => ({
    runs: RUNS,
    dtDays: 5,
    seed: 4242,
    baseState,
    horizonMonths,
    riskAppetite,
    uncertainty,
    strategy,
    blackSwanEnabled,
    successThreshold
  });

  useEffect(() => {
    setTemplates(loadSimTemplates());
    setCustomObjectives(loadCustomObjectives());
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<SimWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress' && message.id === activeRequestId.current) {
        setProgress(message.progress);
      }
      if (message.type === 'done' && message.id === activeRequestId.current) {
        setResult(message.result);
        setRunning(false);
      }
      if (message.type === 'sensitivity-done' && message.id === activeSensitivityId.current) {
        setSensitivity(rankLevers(message.levers));
      }
      if (message.type === 'error') setRunning(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const patch = selectedObjective.defaultConfigPatch;
    if (patch.horizonMonths != null) setHorizonMonths(patch.horizonMonths);
    if (patch.riskAppetite != null) setRiskAppetite(patch.riskAppetite);
    if (patch.uncertainty != null) setUncertainty(patch.uncertainty);
    if (patch.strategy) setStrategy(patch.strategy);
    if (patch.blackSwanEnabled != null) setBlackSwanEnabled(patch.blackSwanEnabled);
    if (patch.successThreshold != null) setSuccessThreshold(patch.successThreshold);
    setNeedsRecalc(true);
  }, [selectedObjective]);

  const startSimulation = () => {
    const worker = workerRef.current;
    if (!worker) return;
    setRunning(true);
    setNeedsRecalc(false);
    setProgress(0);
    const config = buildConfig();
    const runId = `sim-${Date.now()}`;
    const sensitivityId = `sens-${Date.now()}`;
    activeRequestId.current = runId;
    activeSensitivityId.current = sensitivityId;
    worker.postMessage({ type: 'start', id: runId, config });
    worker.postMessage({ type: 'sensitivity', id: sensitivityId, config });
  };

  const createCustomMission = () => {
    const title = window.prompt(t('simulationCustomPrompt', language));
    if (!title || !title.trim()) return;
    const custom = buildCustomObjective(title.trim());
    saveCustomObjective(toCustomObjectivePayload(custom));
    const refreshed = loadCustomObjectives();
    setCustomObjectives(refreshed);
    setObjectiveId(custom.id);
  };

  const saveTemplate = () => {
    const customPayload = customObjectives.find((item) => item.id === objectiveId);
    saveSimTemplate({
      id: `tpl-${Date.now()}`,
      name: `${t('simulationTemplateNamePrefix', language)} ${new Date().toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}`,
      savedAtISO: new Date().toISOString(),
      objectiveId,
      customObjective: customPayload,
      config: buildConfig()
    });
    setTemplates(loadSimTemplates());
  };

  const applyTemplate = (template: SimTemplate) => {
    if (template.customObjective) {
      saveCustomObjective(template.customObjective);
      setCustomObjectives(loadCustomObjectives());
    }
    if (template.objectiveId) setObjectiveId(template.objectiveId);
    const cfg = template.config;
    if (cfg.horizonMonths != null) setHorizonMonths(cfg.horizonMonths);
    if (cfg.riskAppetite != null) setRiskAppetite(cfg.riskAppetite);
    if (cfg.uncertainty != null) setUncertainty(cfg.uncertainty);
    if (cfg.strategy) setStrategy(cfg.strategy);
    if (cfg.blackSwanEnabled != null) setBlackSwanEnabled(cfg.blackSwanEnabled);
    if (cfg.successThreshold != null) setSuccessThreshold(cfg.successThreshold);
    setNeedsRecalc(true);
  };

  const applyMissionLever = (index: number) => {
    const lever = selectedObjective.levers[index];
    if (!lever) return;
    const { configPatch } = lever.patchFn(buildConfig(), baseState);
    if (configPatch.horizonMonths != null) setHorizonMonths(configPatch.horizonMonths);
    if (configPatch.riskAppetite != null) setRiskAppetite(configPatch.riskAppetite);
    if (configPatch.uncertainty != null) setUncertainty(configPatch.uncertainty);
    if (configPatch.strategy) setStrategy(configPatch.strategy);
    if (configPatch.blackSwanEnabled != null) setBlackSwanEnabled(configPatch.blackSwanEnabled);
    if (configPatch.successThreshold != null) setSuccessThreshold(configPatch.successThreshold);
    setNeedsRecalc(true);
  };

  const fanPoints = useMemo(() => buildFanPoints(result?.scoreTrajectory ?? [], horizonMonths), [horizonMonths, result]);
  const failureWindow = useMemo(() => findFailureWindow(fanPoints, successThreshold, horizonMonths), [fanPoints, successThreshold, horizonMonths]);

  const kpiCards = useMemo(() => {
    if (!result) return [];
    const headroom = result.scorePercentiles.p50 - successThreshold;
    const criterionUnit = language === 'ru' ? selectedObjective.successCriterion.unitLabel_ru : selectedObjective.successCriterion.unitLabel_en;
    const values: Record<ObjectiveTemplate['kpiSchema'][number]['id'], string> = {
      successChance: `${Math.round(result.successRatio * 100)}%`,
      headroom: `${headroom >= 0 ? '+' : ''}${Math.round(headroom)} ${criterionUnit}`,
      badOutcome: formatAdaptive(result.scorePercentiles.p10),
      typicalOutcome: formatAdaptive(result.scorePercentiles.p50),
      goodOutcome: formatAdaptive(result.scorePercentiles.p90),
      failureWindow: failureWindow ? `${failureWindow.fromMonth}–${failureWindow.toMonth} ${t('simulationMonthsShort', language)}` : t('simulationOutcomeBreakpointNone', language)
    };
    return selectedObjective.kpiSchema.map((item) => ({ id: item.id, label: kpiLabel(item, language), help: kpiHelp(item, language), value: values[item.id] }));
  }, [failureWindow, language, result, selectedObjective, successThreshold]);

  const topDrivers = useMemo(() => buildDrivers(sensitivity).slice(0, 3), [sensitivity]);

  return (
    <section className={`stack sim-screen ${reducedMotion ? 'reduce-motion' : ''}`}>
      <h2>{t('simulationTitleMission', language)}</h2>

      <section className="card stack sim-mission-block" aria-label={t('simulationSectionMission', language)}>
        <h3>{t('simulationSectionMission', language)}</h3>
        <p>{selectedObjective.description_ru}</p>
        <div className="sim-mission-chips">
          {builtInObjectives.map((mission) => (
            <button key={mission.id} className={`cosBtn cosBtn--ghost ${objectiveId === mission.id ? 'sim-chip-active' : ''}`} onClick={() => setObjectiveId(mission.id)}>{missionTitle(mission, language)}</button>
          ))}
          {customObjectives.map((mission) => (
            <button key={mission.id} className={`cosBtn cosBtn--ghost ${objectiveId === mission.id ? 'sim-chip-active' : ''}`} onClick={() => setObjectiveId(mission.id)}>{missionTitle(mission, language)}</button>
          ))}
          <button className="cosBtn cosBtn--ghost" onClick={createCustomMission}>{t('simulationScenario_custom', language)}</button>
        </div>
      </section>

      <section className="card stack" aria-label={t('simulationSectionLaunch', language)}>
        <h3>{t('simulationSectionLaunch', language)}</h3>
        <label>{t('simulationHorizon', language)}
          <input type="range" min={6} max={36} value={horizonMonths} onChange={(event) => { setHorizonMonths(Number(event.target.value)); setNeedsRecalc(true); }} />
          <span>{horizonMonths} {t('simulationMonthsShort', language)}</span>
        </label>
        <label>{t('simulationRiskAppetite', language)}
          <input type="range" min={0.1} max={1} step={0.05} value={riskAppetite} onChange={(event) => { setRiskAppetite(Number(event.target.value)); setNeedsRecalc(true); }} />
          <span>{Math.round(riskAppetite * 100)}%</span>
        </label>
        <label>{t('simulationUncertainty', language)}
          <input type="range" min={0.1} max={1} step={0.05} value={uncertainty} onChange={(event) => { setUncertainty(Number(event.target.value)); setNeedsRecalc(true); }} />
          <span>{Math.round(uncertainty * 100)}%</span>
        </label>
        <label>{t('simulationThresholdGoal', language)}
          <input type="number" value={successThreshold} onChange={(event) => { setSuccessThreshold(Number(event.target.value)); setNeedsRecalc(true); }} />
        </label>
        <label>{t('simulationStrategy', language)}
          <select value={strategy} onChange={(event) => { setStrategy(event.target.value as StrategyMode); setNeedsRecalc(true); }}>
            <option value="attack">{t('strategyAttack', language)}</option>
            <option value="balance">{t('strategyBalance', language)}</option>
            <option value="defense">{t('strategyDefense', language)}</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={blackSwanEnabled} onChange={(event) => { setBlackSwanEnabled(event.target.checked); setNeedsRecalc(true); }} />
          {t('simulationBlackSwanLabel', language)}
        </label>

        <div className="preset-row">
          <button className="cosBtn cosBtn--accent" onClick={startSimulation}>{needsRecalc ? t('simulationRun', language) : t('simulationRecalculate', language)}</button>
          <button className="cosBtn cosBtn--ghost" onClick={saveTemplate}>{t('simulationSaveTemplate', language)}</button>
        </div>
        {running && <p>{t('simulationProgress', language)}: {Math.round(progress * 100)}%</p>}
        {templates.length > 0 && (
          <div className="sim-templates-row">
            {templates.slice(0, 3).map((template) => (
              <button key={template.id} className="cosBtn cosBtn--ghost" onClick={() => applyTemplate(template)}>{template.name}</button>
            ))}
          </div>
        )}
      </section>

      {result && (
        <section className="card stack" aria-label={t('simulationSectionVerdict', language)}>
          <h3>{t('simulationSectionVerdict', language)}</h3>
          <div className="oracle-kpi-strip sim-kpi-grid-6">
            {kpiCards.map((kpi) => (
              <article key={kpi.id} className="oracle-kpi-chip">
                <small>{kpi.label} <span title={kpi.help} aria-label={kpi.help}>ⓘ</span></small>
                <strong>{kpi.value}</strong>
              </article>
            ))}
          </div>

          <SimpleCorridorChart points={fanPoints} threshold={successThreshold} reducedMotion={reducedMotion} language={language} />

          <h4>{t('simulationDriversTitle', language)}</h4>
          <div className="oracle-drivers">
            {topDrivers.map((driver) => (
              <article key={driver.key} className="oracle-driver-item">
                <strong>{t(driver.titleKey, language)}</strong>
                <p>{t(driver.summaryKey, language)}</p>
              </article>
            ))}
          </div>

          <h4>{t('simulationSectionLevers', language)}</h4>
          <div className="lever-cards-grid">
            {selectedObjective.levers.slice(0, 3).map((lever, index) => (
              <article key={lever.id} className="oracle-lever-card">
                <strong>{index === 0 ? t('simulationLeverCheapest', language) : index === 1 ? t('simulationLeverFastest', language) : t('simulationLeverSafest', language)}</strong>
                <p>{language === 'ru' ? lever.title_ru : lever.title_en}</p>
                <small>{language === 'ru' ? lever.costHint_ru : lever.costHint_en}</small>
                <button className="cosBtn cosBtn--ghost" onClick={() => applyMissionLever(index)}>{t('simulationApplyLever', language)}</button>
              </article>
            ))}
          </div>

          <p>{t('simulationOutcomeSuccessRule', language)}: {selectedObjective.successCriterion.kind} ≥ {selectedObjective.successCriterion.value} {language === 'ru' ? selectedObjective.successCriterion.unitLabel_ru : selectedObjective.successCriterion.unitLabel_en} · {t(strategyLabel(strategy), language)}</p>
        </section>
      )}
    </section>
  );
}
