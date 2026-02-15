import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { scoreState } from '../../../core/sim/model';
import { LeverKey, SimulationResult, StrategyMode } from '../../../core/sim/types';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { t } from '../../../shared/i18n';
import { loadBaseline, loadSimTemplates, saveBaseline, saveSimTemplate, SimTemplate } from '../../../shared/storage/simStorage';
import { UPlotChart, UPlotSeries } from '../../charts/UPlotChart';
import { SensitivityItem, SimConfigPayload, SimWorkerResponse } from '../worker/protocol';

type PresetKey = 'boost' | 'stabilize' | 'storm' | 'focus' | 'diversify';

interface Preset {
  key: PresetKey;
  strategy: StrategyMode;
  horizonMonths: number;
  uncertainty: number;
  riskAppetite: number;
  blackSwanEnabled: boolean;
  threshold: number;
  tradeoffKey: 'tradeoffBoost' | 'tradeoffStabilize' | 'tradeoffStorm' | 'tradeoffFocus' | 'tradeoffDiversify';
}

const presets: Preset[] = [
  { key: 'boost', strategy: 'attack', horizonMonths: 12, uncertainty: 0.62, riskAppetite: 0.82, blackSwanEnabled: false, threshold: 145, tradeoffKey: 'tradeoffBoost' },
  { key: 'stabilize', strategy: 'balance', horizonMonths: 18, uncertainty: 0.4, riskAppetite: 0.45, blackSwanEnabled: true, threshold: 122, tradeoffKey: 'tradeoffStabilize' },
  { key: 'storm', strategy: 'defense', horizonMonths: 16, uncertainty: 0.72, riskAppetite: 0.28, blackSwanEnabled: true, threshold: 110, tradeoffKey: 'tradeoffStorm' },
  { key: 'focus', strategy: 'balance', horizonMonths: 10, uncertainty: 0.34, riskAppetite: 0.56, blackSwanEnabled: false, threshold: 126, tradeoffKey: 'tradeoffFocus' },
  { key: 'diversify', strategy: 'balance', horizonMonths: 24, uncertainty: 0.56, riskAppetite: 0.38, blackSwanEnabled: true, threshold: 118, tradeoffKey: 'tradeoffDiversify' }
];

const eventInfo: Record<LeverKey | 'stressBreaks' | 'drawdownsOver20' | 'blackSwans', string> = {
  riskAppetite: 'simulationRiskEventHintDrawdown',
  uncertainty: 'simulationRiskEventHintStress',
  strategy: 'simulationRiskEventHintBlackSwan',
  horizon: 'simulationRiskEventHintDrawdown',
  blackSwanShield: 'simulationRiskEventHintBlackSwan',
  stressBreaks: 'simulationRiskEventHintStress',
  drawdownsOver20: 'simulationRiskEventHintDrawdown',
  blackSwans: 'simulationRiskEventHintBlackSwan'
};

const runsCount = 10_000;

function outOfTen(value: number): number {
  return Math.round(value * 10);
}

function pct(count: number, total: number): number {
  return total <= 0 ? 0 : Math.round((count / total) * 100);
}

export function SimulationScreen() {
  const { data, setData } = useChaosCore();
  const language = data.settings.language;
  const reducedMotion = useReducedMotion(data.settings.reduceMotionOverride);

  const [horizonMonths, setHorizonMonths] = useState(12);
  const [uncertainty, setUncertainty] = useState(0.5);
  const [riskAppetite, setRiskAppetite] = useState(0.5);
  const [strategy, setStrategy] = useState<StrategyMode>('balance');
  const [blackSwanEnabled, setBlackSwanEnabled] = useState(true);
  const [successThreshold, setSuccessThreshold] = useState(120);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('stabilize');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [baseline, setBaseline] = useState(loadBaseline());
  const [templates, setTemplates] = useState<SimTemplate[]>([]);
  const [sensitivity, setSensitivity] = useState<SensitivityItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [isRunning, setRunning] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const activeSensitivityIdRef = useRef<string | null>(null);

  const configFingerprint = `${horizonMonths}|${uncertainty}|${riskAppetite}|${strategy}|${blackSwanEnabled}|${successThreshold}`;

  useEffect(() => setTemplates(loadSimTemplates()), []);

  useEffect(() => {
    const worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<SimWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'sensitivity-done' && message.id === activeSensitivityIdRef.current) {
        setSensitivity(message.levers);
      }
      if (message.id !== activeIdRef.current) return;
      if (message.type === 'progress') {
        setProgress(message.progress);
        setResult(message.partialResult);
      }
      if (message.type === 'done') {
        setRunning(false);
        setProgress(1);
        setResult(message.result);
      }
      if (message.type === 'cancelled' || message.type === 'error') {
        setRunning(false);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;
    if (activeIdRef.current) workerRef.current.postMessage({ type: 'cancel', id: activeIdRef.current });
    if (activeSensitivityIdRef.current) workerRef.current.postMessage({ type: 'cancel', id: activeSensitivityIdRef.current });
  }, [configFingerprint]);

  const buildConfig = (): SimConfigPayload => ({
    runs: runsCount,
    horizonMonths,
    dtDays: 5,
    seed: 4242,
    baseState: {
      capital: Math.max(40, data.xp * 0.6),
      resilience: (data.stats.wisdom + data.stats.dexterity) * 2,
      momentum: (data.stats.strength + data.stats.intelligence) * 1.4,
      stress: Math.max(5, 30 - data.stats.wisdom)
    },
    strategy,
    uncertainty,
    riskAppetite,
    blackSwanEnabled,
    successThreshold
  });

  const startSimulation = () => {
    const worker = workerRef.current;
    if (!worker) return;
    const requestId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeIdRef.current = requestId;
    setProgress(0);
    setRunning(true);
    worker.postMessage({ type: 'start', id: requestId, config: buildConfig() });

    const sensitivityId = `sens-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeSensitivityIdRef.current = sensitivityId;
    worker.postMessage({ type: 'sensitivity', id: sensitivityId, config: buildConfig() });
  };

  const applyPreset = (presetKey: PresetKey) => {
    const preset = presets.find((item) => item.key === presetKey);
    if (!preset) return;
    setSelectedPreset(presetKey);
    setHorizonMonths(preset.horizonMonths);
    setUncertainty(preset.uncertainty);
    setRiskAppetite(preset.riskAppetite);
    setStrategy(preset.strategy);
    setBlackSwanEnabled(preset.blackSwanEnabled);
    setSuccessThreshold(preset.threshold);
  };

  const saveCurrentTemplate = () => {
    const template: SimTemplate = {
      id: `tpl-${Date.now()}`,
      name: `${t('simulationTemplateNamePrefix', language)} ${new Date().toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}`,
      savedAtISO: new Date().toISOString(),
      config: buildConfig()
    };
    saveSimTemplate(template);
    setTemplates(loadSimTemplates());
  };

  const applyTemplate = (template: SimTemplate) => {
    const cfg = template.config;
    if (typeof cfg.horizonMonths === 'number') setHorizonMonths(cfg.horizonMonths);
    if (typeof cfg.uncertainty === 'number') setUncertainty(cfg.uncertainty);
    if (typeof cfg.riskAppetite === 'number') setRiskAppetite(cfg.riskAppetite);
    if (cfg.strategy) setStrategy(cfg.strategy);
    if (typeof cfg.blackSwanEnabled === 'boolean') setBlackSwanEnabled(cfg.blackSwanEnabled);
    if (typeof cfg.successThreshold === 'number') setSuccessThreshold(cfg.successThreshold);
  };

  const fanData = useMemo(() => {
    const trajectory = result?.scoreTrajectory ?? [];
    const x = trajectory.map((point) => point.dayOffset * 86400);
    return [
      x,
      trajectory.map((point) => point.p10),
      trajectory.map((point) => point.p50),
      trajectory.map((point) => point.p90),
      x.map(() => successThreshold),
      ...(baseline ? [baseline.result.scoreTrajectory.map((point) => point.dayOffset * 86400), baseline.result.scoreTrajectory.map((point) => point.p50)] : [])
    ];
  }, [result, successThreshold, baseline]);

  const fanSeries: UPlotSeries[] = useMemo(() => ([
    { label: t('scenarioBad', language), color: '#6a84b7', fill: 'rgba(100,130,180,0.16)' },
    { label: t('scenarioTypical', language), color: '#56d9a4', width: 3, fill: 'rgba(86,217,164,0.16)' },
    { label: t('scenarioGood', language), color: '#f8b66b', fill: 'rgba(248,182,107,0.08)' },
    { label: t('simulationThreshold', language), color: '#ff6f7d', dash: [8, 6], width: 2 },
    ...(baseline ? [{ label: t('simulationCompareBaseline', language), color: '#b9c0d4', dash: [4, 5], width: 2 }] : [])
  ]), [language, baseline]);

  const effectiveIndex = pinnedIndex ?? scrubIndex;
  const tooltip = useMemo(() => {
    if (!result || effectiveIndex == null) return null;
    const point = result.scoreTrajectory[effectiveIndex];
    if (!point) return null;
    const month = Math.max(1, Math.round(point.dayOffset / 30));
    const k = point.dayOffset / Math.max(1, result.horizonMonths * 30);
    const stressCount = Math.round(result.riskEvents.stressBreaks * k);
    return { point, month, stressCount };
  }, [effectiveIndex, result]);

  const histogram = useMemo(() => {
    if (!result) return null;
    const max = Math.max(...result.endingScore.bins, 1);
    return result.endingScore.bins.map((bin) => (bin / max) * 100);
  }, [result]);

  const selectedTradeoff = presets.find((preset) => preset.key === selectedPreset)?.tradeoffKey ?? 'tradeoffStabilize';
  const baseScore = useMemo(() => scoreState({
    capital: Math.max(40, data.xp * 0.6),
    resilience: (data.stats.wisdom + data.stats.dexterity) * 2,
    momentum: (data.stats.strength + data.stats.intelligence) * 1.4,
    stress: Math.max(5, 30 - data.stats.wisdom)
  }), [data.stats.dexterity, data.stats.intelligence, data.stats.strength, data.stats.wisdom, data.xp]);

  const makeQuest = () => {
    const summary = `${t('simulationQuestPrefix', language)}: ${t('simulationThreshold', language)} ${successThreshold}, ${t('simulationHorizon', language)} ${horizonMonths}`;
    setData((current) => ({
      ...current,
      history: [{ id: `quest-${Date.now()}`, kind: 'quest', note: summary, atISO: new Date().toISOString() }, ...current.history]
    }));
  };

  return (
    <section className={`stack sim-screen${reducedMotion ? ' reduce-motion' : ''}`}>
      <h2>{t('simulationTitle', language)}</h2>
      <p>{t('simulationMeaningLine', language)}</p>

      <div className="card stack">
        <div className="preset-row sim-preset-row">
          {presets.map((preset) => (
            <button key={preset.key} className={selectedPreset === preset.key ? 'active-choice' : ''} onClick={() => applyPreset(preset.key)}>{t(`preset_${preset.key}` as never, language)}</button>
          ))}
        </div>
        <p><strong>{t('simulationTradeoff', language)}:</strong> {t(selectedTradeoff, language)}</p>
        <div className="preset-row">
          <button onClick={saveCurrentTemplate}>{t('simulationSaveTemplate', language)}</button>
          <button onClick={() => applyPreset('stabilize')}>{t('simulationReset', language)}</button>
        </div>
        {templates.length > 0 && <div className="preset-row sim-templates-row">{templates.slice(0, 3).map((template) => <button key={template.id} onClick={() => applyTemplate(template)}>{template.name}</button>)}</div>}
      </div>

      <div className="card stack">
        <label>{t('simulationHorizon', language)}: {horizonMonths}
          <input type="range" min={6} max={30} value={horizonMonths} onChange={(e) => setHorizonMonths(Number(e.target.value))} />
        </label>
        <label>{t('simulationThreshold', language)}: {successThreshold}
          <input type="range" min={80} max={180} step={1} value={successThreshold} onChange={(e) => setSuccessThreshold(Number(e.target.value))} />
        </label>
        <small>{t('simulationThresholdHelp', language)}</small>
        <label>{t('simulationUncertainty', language)}: {uncertainty.toFixed(2)}
          <input type="range" min={0.1} max={1} step={0.01} value={uncertainty} onChange={(e) => setUncertainty(Number(e.target.value))} />
        </label>
        <label>{t('simulationRiskAppetite', language)}: {riskAppetite.toFixed(2)}
          <input type="range" min={0.1} max={1} step={0.01} value={riskAppetite} onChange={(e) => setRiskAppetite(Number(e.target.value))} />
        </label>
        <label>{t('simulationStrategy', language)}
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyMode)}>
            <option value="attack">{t('strategyAttack', language)}</option>
            <option value="balance">{t('strategyBalance', language)}</option>
            <option value="defense">{t('strategyDefense', language)}</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={blackSwanEnabled} onChange={(e) => setBlackSwanEnabled(e.target.checked)} />
          {t('simulationBlackSwan', language)}
        </label>
        <button onClick={startSimulation}>{isRunning ? t('simulationRunning', language) : t('simulationRun', language)}</button>
        {isRunning && <p>{t('simulationProgress', language)}: {Math.round(progress * 100)}%</p>}
      </div>

      {result && (
        <>
          <div className="card stack">
            <strong>{t('simulationTrajectoryTitle', language)}</strong>
            <UPlotChart data={fanData} series={fanSeries} kind="time-series" reducedMotion={reducedMotion} ariaLabel={t('simulationTrajectoryTitle', language)} onScrubIndex={(index) => setScrubIndex(index)} />
            <div className="preset-row">
              <button onClick={() => setPinnedIndex(scrubIndex)}>{t('simulationPinPoint', language)}</button>
              <button onClick={() => setPinnedIndex(null)}>{t('simulationUnpin', language)}</button>
            </div>
            {tooltip && (
              <div className="card sim-tooltip">
                <strong>{t('simulationMonth', language)} {tooltip.month}</strong>
                <p>{t('scenarioBad', language)}: {Math.round(tooltip.point.p10)}</p>
                <p>{t('scenarioTypical', language)}: {Math.round(tooltip.point.p50)}</p>
                <p>{t('scenarioGood', language)}: {Math.round(tooltip.point.p90)}</p>
                <p>{t('simulationRiskEventsSoFar', language)}: ~{tooltip.stressCount}</p>
              </div>
            )}
            <p>{t('simulationChanceOutOfTen', language)}: <strong>{outOfTen(result.successRatio)}</strong> · {t('simulationMetaLine', language)} {successThreshold} / {horizonMonths} / {result.runs}</p>
          </div>

          <div className="card stack">
            <strong>{t('simulationVerdictTitle', language)}</strong>
            <p>{successThreshold > baseScore + 35 ? t('simulationVerdictHighThreshold', language) : t('simulationVerdictOk', language)}</p>
            <ul>
              <li>{t('simulationWhyOne', language)}</li>
              <li>{t('simulationWhyTwo', language)}</li>
            </ul>
            <strong>{t('simulationNextActionsTitle', language)}</strong>
            <ol>
              <li>{t('simulationNextOne', language)}</li>
              <li>{t('simulationNextTwo', language)}</li>
              <li>{t('simulationNextThree', language)}</li>
            </ol>
          </div>

          <div className="card stack">
            <strong>{t('simulationTopLevers', language)}</strong>
            <ol>
              {sensitivity.map((lever) => (
                <li key={`${lever.labelKey}-${lever.score}`}>
                  {t(lever.labelKey as never, language)} · {t('simulationLeverSuccessDelta', language)} {lever.successDelta >= 0 ? '+' : ''}{lever.successDelta}/10 · {t('simulationLeverDrawdownDelta', language)} {lever.drawdownDelta >= 0 ? '+' : ''}{lever.drawdownDelta}%
                </li>
              ))}
            </ol>
            <strong>{t('simulationRiskEvents', language)}</strong>
            <p title={t(eventInfo.stressBreaks as never, language)}>{t('simulationStressBreaks', language)}: {pct(result.riskEvents.stressBreaks, result.runs)}% <small>({result.riskEvents.stressBreaks}/{result.runs})</small></p>
            <p title={t(eventInfo.drawdownsOver20 as never, language)}>{t('simulationDrawdowns', language)}: {pct(result.riskEvents.drawdownsOver20, result.runs)}% <small>({result.riskEvents.drawdownsOver20}/{result.runs})</small></p>
            <p title={t(eventInfo.blackSwans as never, language)}>{t('simulationBlackSwansCount', language)}: {pct(result.riskEvents.blackSwans, result.runs)}% <small>({result.riskEvents.blackSwans}/{result.runs})</small></p>
          </div>

          <div className="card stack">
            <strong>{t('simulationHistogramTitle', language)}</strong>
            <div className="sim-histogram" role="img" aria-label={t('simulationHistogramTitle', language)}>
              {histogram?.map((height, index) => (
                <div key={index} className="sim-bar" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>

          <div className="card stack">
            <div className="preset-row">
              <button onClick={makeQuest}>{t('simulationMakeQuest', language)}</button>
              <button onClick={() => { if (result) { saveBaseline({ label: new Date().toLocaleTimeString(), result: { scoreTrajectory: result.scoreTrajectory, horizonMonths: result.horizonMonths, runs: result.runs }, savedAtISO: new Date().toISOString() }); setBaseline(loadBaseline()); } }}>{t('simulationCompare', language)}</button>
              <button onClick={saveCurrentTemplate}>{t('simulationSaveTemplate', language)}</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
