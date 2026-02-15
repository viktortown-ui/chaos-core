import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { SimulationResult, StrategyMode } from '../../../core/sim/types';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { t } from '../../../shared/i18n';
import { loadBaseline, loadSimTemplates, saveBaseline, saveSimTemplate, SimTemplate } from '../../../shared/storage/simStorage';
import { UPlotChart, UPlotSeries } from '../../charts/UPlotChart';
import { SensitivityItem, SimConfigPayload, SimWorkerResponse } from '../worker/protocol';
import { buildRiskDisplayMetric, DISCRETE_LEVEL_VALUES, formatMonthTick, nearestDiscreteLevel, riskEffectKey, successMeterLabel, togglePin, uncertaintyEffectKey } from './simulationViewModel';

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
  { key: 'boost', strategy: 'attack', horizonMonths: 12, uncertainty: 0.6, riskAppetite: 0.8, blackSwanEnabled: false, threshold: 145, tradeoffKey: 'tradeoffBoost' },
  { key: 'stabilize', strategy: 'balance', horizonMonths: 18, uncertainty: 0.4, riskAppetite: 0.4, blackSwanEnabled: true, threshold: 122, tradeoffKey: 'tradeoffStabilize' },
  { key: 'storm', strategy: 'defense', horizonMonths: 16, uncertainty: 0.8, riskAppetite: 0.2, blackSwanEnabled: true, threshold: 110, tradeoffKey: 'tradeoffStorm' },
  { key: 'focus', strategy: 'balance', horizonMonths: 10, uncertainty: 0.4, riskAppetite: 0.6, blackSwanEnabled: false, threshold: 126, tradeoffKey: 'tradeoffFocus' },
  { key: 'diversify', strategy: 'balance', horizonMonths: 24, uncertainty: 0.6, riskAppetite: 0.4, blackSwanEnabled: true, threshold: 118, tradeoffKey: 'tradeoffDiversify' }
];

const runsCount = 10_000;

function outOfTen(value: number): number {
  return Math.round(value * 10);
}

function pulseAndVibrate(trigger: () => void, reducedMotion: boolean) {
  if (!reducedMotion) trigger();
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
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
  const [heroPulse, setHeroPulse] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const activeSensitivityIdRef = useRef<string | null>(null);

  const configFingerprint = `${horizonMonths}|${uncertainty}|${riskAppetite}|${strategy}|${blackSwanEnabled}|${successThreshold}`;

  useEffect(() => setTemplates(loadSimTemplates()), []);

  useEffect(() => {
    if (!heroPulse) return;
    const timeout = setTimeout(() => setHeroPulse(false), 220);
    return () => clearTimeout(timeout);
  }, [heroPulse]);

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
    setRunning(true);
    setProgress(0);
    setPinnedIndex(null);
    setScrubIndex(null);
    const requestId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeIdRef.current = requestId;
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

  const applyBestLever = () => {
    const best = sensitivity[0];
    if (!best) return;
    const cfg = best.nextConfig;
    if (typeof cfg.horizonMonths === 'number') setHorizonMonths(cfg.horizonMonths);
    if (typeof cfg.riskAppetite === 'number') setRiskAppetite(cfg.riskAppetite);
    if (typeof cfg.successThreshold === 'number') setSuccessThreshold(cfg.successThreshold);
    if (cfg.strategy) setStrategy(cfg.strategy);
    pulseAndVibrate(() => setHeroPulse(true), reducedMotion);
  };

  const fanData = useMemo(() => {
    const trajectory = result?.scoreTrajectory ?? [];
    const x = trajectory.map((_, index) => index + 1);
    return [
      x,
      trajectory.map((point) => point.p10),
      trajectory.map((point) => point.p50),
      trajectory.map((point) => point.p90),
      x.map(() => successThreshold),
      ...(baseline ? [baseline.result.scoreTrajectory.map((_, index) => index + 1), baseline.result.scoreTrajectory.map((point) => point.p50)] : [])
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
    return { point, month: effectiveIndex + 1 };
  }, [effectiveIndex, result]);

  const histogram = useMemo(() => {
    if (!result) return null;
    const max = Math.max(...result.endingScore.bins, 1);
    return result.endingScore.bins.map((bin) => (bin / max) * 100);
  }, [result]);

  const selectedTradeoff = presets.find((preset) => preset.key === selectedPreset)?.tradeoffKey ?? 'tradeoffStabilize';

  const riskSummary = useMemo(() => {
    if (!result) return null;
    return {
      stressBreaks: buildRiskDisplayMetric(result.riskEvents.stressBreaks, result.runs),
      drawdownsOver20: buildRiskDisplayMetric(result.riskEvents.drawdownsOver20, result.runs),
      blackSwans: buildRiskDisplayMetric(result.riskEvents.blackSwans, result.runs)
    };
  }, [result]);

  const successMeter = result ? outOfTen(result.successRatio) : 0;
  const meterLabelKey = successMeterLabel(successMeter);
  const thresholdHeadroom = result ? Math.round(result.scorePercentiles.p50 - successThreshold) : null;
  const spread = result ? Math.round(result.scorePercentiles.p90 - result.scorePercentiles.p10) : null;

  const uncertaintyLevel = nearestDiscreteLevel(uncertainty);
  const riskLevel = nearestDiscreteLevel(riskAppetite);

  const makeQuest = () => {
    const summary = `${t('simulationQuestPrefix', language)}: ${t('simulationThreshold', language)} ${successThreshold}, ${t('simulationHorizon', language)} ${horizonMonths}`;
    setData((current) => ({
      ...current,
      history: [{ id: `quest-${Date.now()}`, kind: 'quest', note: summary, atISO: new Date().toISOString() }, ...current.history]
    }));
  };

  const gaugeLength = 2 * Math.PI * 44;
  const gaugeProgress = (Math.max(0, Math.min(10, successMeter)) / 10) * gaugeLength;

  return (
    <section className={`stack sim-screen${reducedMotion ? ' reduce-motion' : ''}`}>
      <h2>{t('simulationTitle', language)}</h2>
      <div className="sim-inline-intro">
        <p>{t('simulationMeaningLine', language)}</p>
        <details>
          <summary aria-label={t('simulationWhatIsThis', language)}>ⓘ</summary>
          <p>{t('simulationWhatIsThisBody', language)}</p>
        </details>
      </div>

      <div className="card stack">
        <div className="preset-row sim-preset-row">
          {presets.map((preset) => (
            <button key={preset.key} className={selectedPreset === preset.key ? 'active-choice' : ''} onClick={() => applyPreset(preset.key)}>{t(`preset_${preset.key}` as never, language)}</button>
          ))}
        </div>
        <p><strong>{t('simulationTradeoff', language)}:</strong> {t(selectedTradeoff, language)}</p>
      </div>

      <div className={`card stack sim-hero${heroPulse ? ' sim-hero-pulse' : ''}`}>
        <strong>{t('simulationHeroTitle', language)}</strong>
        {!result && <p>{t('simulationHeroEmpty', language)}</p>}
        {result && (
          <>
            <div className="sim-gauge-row">
              <svg viewBox="0 0 120 120" className="sim-gauge" role="img" aria-label={t('simulationChanceOutOfTen', language)}>
                <circle cx="60" cy="60" r="44" className="sim-gauge-bg" />
                <circle cx="60" cy="60" r="44" className="sim-gauge-value" style={{ strokeDasharray: `${gaugeProgress} ${gaugeLength}` }} />
                <text x="60" y="58" textAnchor="middle" className="sim-gauge-number">{successMeter}</text>
                <text x="60" y="76" textAnchor="middle" className="sim-gauge-total">/10</text>
              </svg>
              <div>
                <strong>{t(meterLabelKey, language)}</strong>
                <p>{t('simulationThresholdHeadroom', language)}: <strong>{thresholdHeadroom}</strong></p>
                <p>{t('simulationSpread', language)}: <strong>{spread}</strong></p>
              </div>
            </div>
          </>
        )}
        <div className="preset-row sim-primary-actions">
          <button onClick={applyBestLever} disabled={!sensitivity[0]}>{t('simulationApplyBestLever', language)}</button>
          <button onClick={makeQuest}>{t('simulationMakeQuest', language)}</button>
        </div>
      </div>

      <div className="card stack">
        <label>{t('simulationHorizon', language)}: {horizonMonths}
          <input type="range" min={6} max={30} value={horizonMonths} onChange={(e) => setHorizonMonths(Number(e.target.value))} />
        </label>
        <label>{t('simulationThreshold', language)}: {successThreshold}
          <input type="range" min={80} max={180} step={1} value={successThreshold} onChange={(e) => setSuccessThreshold(Number(e.target.value))} />
        </label>
        <small>{t('simulationThresholdHelp', language)}</small>

        <label>{t('simulationUncertainty', language)}: {t(`simulationUncertaintyLevel${uncertaintyLevel + 1}` as never, language)} <span title={t('simulationUncertaintyTooltip', language)} className="sim-help-dot">?</span>
          <input type="range" min={0} max={4} step={1} value={uncertaintyLevel} onChange={(e) => setUncertainty(DISCRETE_LEVEL_VALUES[Number(e.target.value)])} />
        </label>
        <small>{t('simulationFutureFan', language)}: {t(uncertaintyEffectKey(uncertaintyLevel), language)}</small>

        <label>{t('simulationRiskAppetite', language)}: {t(`simulationRiskLevel${riskLevel + 1}` as never, language)} <span title={t('simulationRiskTooltip', language)} className="sim-help-dot">?</span>
          <input type="range" min={0} max={4} step={1} value={riskLevel} onChange={(e) => setRiskAppetite(DISCRETE_LEVEL_VALUES[Number(e.target.value)])} />
        </label>
        <small>{t('simulationRiskPrice', language)}: {t(riskEffectKey(riskLevel), language)}</small>

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
        <div className="preset-row">
          <button onClick={startSimulation}>{isRunning ? t('simulationRunning', language) : t('simulationRun', language)}</button>
          <button onClick={saveCurrentTemplate}>{t('simulationSaveTemplate', language)}</button>
          <button onClick={() => applyPreset('stabilize')}>{t('simulationReset', language)}</button>
        </div>
        {templates.length > 0 && <div className="preset-row sim-templates-row">{templates.slice(0, 3).map((template) => <button key={template.id} onClick={() => applyTemplate(template)}>{template.name}</button>)}</div>}
        {isRunning && <p>{t('simulationProgress', language)}: {Math.round(progress * 100)}%</p>}
      </div>

      {result && (
        <>
          <div className="card stack">
            <strong>{t('simulationTrajectoryTitle', language)}</strong>
            <UPlotChart
              data={fanData}
              series={fanSeries}
              kind="time-series"
              reducedMotion={reducedMotion}
              ariaLabel={t('simulationTrajectoryTitle', language)}
              showLegend={false}
              onScrubIndex={setScrubIndex}
              onTogglePin={(idx) => {
                setPinnedIndex((current) => {
                  const next = togglePin(current, idx);
                  pulseAndVibrate(() => setHeroPulse(true), reducedMotion);
                  return next;
                });
              }}
              xAxisConfig={{ isTimeScale: false, values: (_u, values) => values.map((value) => formatMonthTick(value)) }}
            />
            {!tooltip && <p className="sim-legend-hint">{t('simulationChartHint', language)}</p>}
            <div className="sim-legend-row">
              <span><i className="chip bad" />{t('scenarioBad', language)}{tooltip ? `: ${Math.round(tooltip.point.p10)}` : ''}</span>
              <span><i className="chip typical" />{t('scenarioTypical', language)}{tooltip ? `: ${Math.round(tooltip.point.p50)}` : ''}</span>
              <span><i className="chip good" />{t('scenarioGood', language)}{tooltip ? `: ${Math.round(tooltip.point.p90)}` : ''}</span>
              <span className="sim-threshold-chip"><i className="chip threshold" />{t('simulationThreshold', language)} {successThreshold}</span>
            </div>
            {tooltip && (
              <div className="card sim-tooltip">
                <strong>{t('simulationTooltipMonth', language)} {tooltip.month}</strong>
                {pinnedIndex != null && <span className="sim-pinned-pill">{t('simulationPinnedMonth', language)} {tooltip.month}</span>}
                <p>{t('scenarioBad', language)}: {Math.round(tooltip.point.p10)}</p>
                <p>{t('scenarioTypical', language)}: {Math.round(tooltip.point.p50)}</p>
                <p>{t('scenarioGood', language)}: {Math.round(tooltip.point.p90)}</p>
              </div>
            )}
          </div>

          <details className="card stack" open>
            <summary>{t('simulationDetails', language)}</summary>
            <strong>{t('simulationTopLevers', language)}</strong>
            <ol>
              {sensitivity.map((lever) => (
                <li key={`${lever.labelKey}-${lever.score}`}>
                  {t(lever.labelKey as never, language)} · {t('simulationLeverSuccessDelta', language)} {lever.successDelta >= 0 ? '+' : ''}{lever.successDelta}/10 · {t('simulationLeverDrawdownDelta', language)} {lever.drawdownDelta >= 0 ? '+' : ''}{lever.drawdownDelta}%
                </li>
              ))}
            </ol>
            {riskSummary && (
              <>
                <strong>{t('simulationRiskEvents', language)}</strong>
                <p>{t('simulationStressBreaks', language)}: {Math.round(riskSummary.stressBreaks.shareOfWorldsPct)}% {t('simulationWorldsSuffix', language)} ({riskSummary.stressBreaks.worldsWithEvent}/{result.runs}) · {riskSummary.stressBreaks.avgPerWorld.toFixed(1)} {t('simulationEventsPerWorld', language)}</p>
                <p>{t('simulationDrawdowns', language)}: {Math.round(riskSummary.drawdownsOver20.shareOfWorldsPct)}% {t('simulationWorldsSuffix', language)} ({riskSummary.drawdownsOver20.worldsWithEvent}/{result.runs}) · {riskSummary.drawdownsOver20.avgPerWorld.toFixed(1)} {t('simulationEventsPerWorld', language)}</p>
                <p>{t('simulationBlackSwansCount', language)}: {Math.round(riskSummary.blackSwans.shareOfWorldsPct)}% {t('simulationWorldsSuffix', language)} ({riskSummary.blackSwans.worldsWithEvent}/{result.runs}) · {riskSummary.blackSwans.avgPerWorld.toFixed(1)} {t('simulationEventsPerWorld', language)}</p>
              </>
            )}

            <strong>{t('simulationHistogramTitle', language)}</strong>
            <div className="sim-histogram" role="img" aria-label={t('simulationHistogramTitle', language)}>
              {histogram?.map((height, index) => (
                <div key={index} className="sim-bar" style={{ height: `${height}%` }} />
              ))}
            </div>

            <details>
              <summary>{t('simulationAdvanced', language)}</summary>
              <p>{t('simulationRawMedian', language)}: {Math.round(result.scorePercentiles.p50)}</p>
              <p>{t('simulationRawP10', language)}: {Math.round(result.scorePercentiles.p10)}</p>
              <p>{t('simulationRawP90', language)}: {Math.round(result.scorePercentiles.p90)}</p>
              <p>{t('simulationRawUncertainty', language)}: {uncertainty.toFixed(2)}</p>
              <p>{t('simulationRawRiskAppetite', language)}: {riskAppetite.toFixed(2)}</p>
            </details>
          </details>

          <div className="card stack">
            <div className="preset-row">
              <button onClick={() => { if (result) { saveBaseline({ label: new Date().toLocaleTimeString(), result: { scoreTrajectory: result.scoreTrajectory, horizonMonths: result.horizonMonths, runs: result.runs }, savedAtISO: new Date().toISOString() }); setBaseline(loadBaseline()); } }}>{t('simulationCompare', language)}</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
