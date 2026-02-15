import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { SimulationResult, StrategyMode } from '../../../core/sim/types';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { t } from '../../../shared/i18n';
import { loadBaseline, loadSimTemplates, saveBaseline, saveSimTemplate, SimTemplate } from '../../../shared/storage/simStorage';
import { UPlotChart, UPlotSeries } from '../../charts/UPlotChart';
import { SensitivityItem, SimConfigPayload, SimWorkerResponse } from '../worker/protocol';
import { buildHeadroomChipModel, buildRiskDisplayMetric, buildSpreadChipModel, DISCRETE_LEVEL_VALUES, formatMonthTick, heroStatusLabel, nearestDiscreteLevel, rankLevers, riskCostLineKey, riskEffectKey, strategicLeverTitleKey, successMeterLabel, togglePin, uncertaintyEffectKey } from './simulationViewModel';

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

const presetIcons: Record<PresetKey, string> = {
  boost: '⚡',
  stabilize: '🛡',
  storm: '☄',
  focus: '◎',
  diversify: '✧'
};

function outOfTen(value: number): number {
  return Math.round(value * 10);
}

function pulseAndVibrate(trigger: () => void, reducedMotion: boolean) {
  if (!reducedMotion) trigger();
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
}

function CoreOrb({ reducedMotion, score }: { reducedMotion: boolean; score: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.createRadialGradient !== 'function') return;

    const draw = (time = 0) => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      ctx.clearRect(0, 0, width, height);

      const pulse = reducedMotion ? 0.92 : 0.92 + Math.sin(time / 580) * 0.04;
      const coreRadius = 34 * pulse;
      const gradient = ctx.createRadialGradient(cx - 9, cy - 10, 7, cx, cy, coreRadius + 14);
      gradient.addColorStop(0, 'rgba(159, 236, 255, 0.92)');
      gradient.addColorStop(0.45, 'rgba(91, 184, 245, 0.82)');
      gradient.addColorStop(1, 'rgba(33, 77, 126, 0.22)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(112, 224, 255, 0.42)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 48, 22, 0.35, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(245, 183, 108, 0.46)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 53, 27, -0.4, 0, Math.PI * 2);
      ctx.stroke();

      const particles = 7;
      for (let i = 0; i < particles; i += 1) {
        const angle = (i / particles) * Math.PI * 2 + (reducedMotion ? 0 : time / 2200);
        const radius = 42 + (i % 3) * 5;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * (radius * 0.45);
        ctx.fillStyle = 'rgba(177, 233, 255, 0.72)';
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(244, 248, 255, 0.95)';
      ctx.font = '700 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${score}/10`, cx, cy + 5);
    };

    draw();
    if (reducedMotion) return;

    let frameId = 0;
    const animate = (time: number) => {
      draw(time);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [reducedMotion, score]);

  return <canvas ref={canvasRef} className="sim-orb" width={150} height={150} aria-hidden="true" />;
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
  const statusKey = heroStatusLabel(successMeter);
  const statusSublineKey = statusKey === 'simulationHeroStatusSuccess'
    ? 'simulationHeroSublineSuccess'
    : statusKey === 'simulationHeroStatusEdge'
      ? 'simulationHeroSublineNear'
      : 'simulationHeroSublineFail';
  const thresholdHeadroom = result ? Math.round(result.scorePercentiles.p50 - successThreshold) : null;
  const spread = result ? Math.round(result.scorePercentiles.p90 - result.scorePercentiles.p10) : null;
  const headroomChip = thresholdHeadroom == null ? null : buildHeadroomChipModel(thresholdHeadroom);
  const spreadChip = spread == null ? null : buildSpreadChipModel(spread);
  const topStrategicLevers = rankLevers(sensitivity).slice(0, 3);

  const uncertaintyLevel = nearestDiscreteLevel(uncertainty);
  const riskLevel = nearestDiscreteLevel(riskAppetite);

  const makeQuest = () => {
    const summary = `${t('simulationQuestPrefix', language)}: ${t('simulationThreshold', language)} ${successThreshold}, ${t('simulationHorizon', language)} ${horizonMonths}`;
    setData((current) => ({
      ...current,
      history: [{ id: `quest-${Date.now()}`, kind: 'quest', note: summary, atISO: new Date().toISOString() }, ...current.history]
    }));
  };

  return (
    <section className={`stack sim-screen cosmos-hud${reducedMotion ? ' reduce-motion' : ''}`}>
      <div className="simBackdrop" aria-hidden="true" />
      <h2>{t('simulationTitle', language)}</h2>
      <div className="cosShell stack">
        <div className="sim-inline-intro">
          <p>{t('simulationMeaningLine', language)}</p>
          <details>
            <summary aria-label={t('simulationWhatIsThis', language)}>ⓘ</summary>
            <p>{t('simulationWhatIsThisBody', language)}</p>
          </details>
        </div>

        <div className={`cosHero stack sim-hero${heroPulse ? ' sim-hero-pulse' : ''}${reducedMotion ? ' no-pulse' : ''}`}>
          <div className="sim-chart-head">
            <strong>{t('simulationCoreConsole', language)}</strong>
            <span className="cosChip">{t('simulationHeroCoreTitle', language)}</span>
          </div>
          <div className="sim-hero-layout">
            <div className="sim-hero-core">
              <CoreOrb reducedMotion={reducedMotion} score={successMeter} />
              <p className="sim-hero-core-title">{t('simulationHeroCoreTitle', language)}</p>
            </div>
            <div className="sim-hero-main stack">
              <strong>{t('simulationHeroHeadline', language)}</strong>
              {!result && <p>{t('simulationHeroEmpty', language)}</p>}
              {result && (
                <>
                  <p className="sim-hero-status">{t(statusKey, language)}</p>
                  <p className="sim-hero-meter">{t(meterLabelKey, language)}</p>
                  <p className="sim-hero-subline">{t(statusSublineKey, language)}</p>
                  <div className="sim-hero-metrics">
                    {headroomChip && (
                      <span className={`cosChip sim-sense-chip sim-sense-chip--${headroomChip.tone}`}>
                        <b>{headroomChip.icon} {headroomChip.tone === 'positive' ? `${t('simulationChipHeadroomStatePositive', language)} ${headroomChip.value}` : `${t('simulationChipHeadroomLabel', language)} ${headroomChip.value}`}</b>
                        <small>{t(headroomChip.helpKey, language)} · {t(headroomChip.fuelKey, language)}</small>
                      </span>
                    )}
                    {spreadChip && (
                      <span className="cosChip sim-sense-chip sim-sense-chip--spread">
                        <b>{t('simulationChipSpreadLabel', language)} {spreadChip.fan}/10</b>
                        <i className="sim-fan-arc" aria-hidden="true" />
                        <small>{t(spreadChip.helpKey, language)}</small>
                      </span>
                    )}
                    <span className="cosChip sim-sense-chip sim-sense-chip--risk">
                      <b>{t('simulationRiskCostLine', language)}</b>
                      <small>{t(riskCostLineKey(riskLevel), language)}</small>
                    </span>
                  </div>
                </>
              )}
              <div className="preset-row sim-primary-actions">
                <button className="cosBtn cosBtn--accent" onClick={applyBestLever} disabled={!sensitivity[0]}>
                  <span>{t('simulationApplyBestLever', language)}</span>
                  <small>{t('simulationApplyBestLeverSubtext', language)}</small>
                </button>
                <button className="cosBtn" onClick={makeQuest}>
                  <span>{t('simulationMakeQuest', language)}</span>
                  <small>{t('simulationMakeQuestSubtext', language)}</small>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="cosDivider" aria-hidden="true" />

        <div className="cosDock stack">
          <div className="sim-chart-head">
            <strong>{t('simulationLeversDockTitle', language)}</strong>
            <span className="cosChip">{t('simulationDockSubtitle', language)}</span>
          </div>
          <div className="sim-dock-row" role="group" aria-label={t('simulationLeversDockTitle', language)}>
            {presets.map((preset) => (
              <button key={preset.key} className={`cosBtn cosBtn--ghost sim-dock-btn${selectedPreset === preset.key ? ' sim-dock-btn-active' : ''}`} onClick={() => applyPreset(preset.key)}>
                <span aria-hidden="true">{presetIcons[preset.key]}</span>
                <span>{t(`preset_${preset.key}` as never, language)}</span>
              </button>
            ))}
          </div>
          <p>{t('simulationTradeoff', language)}: {t(selectedTradeoff, language)}</p>
        </div>

        <div className="cosDivider" aria-hidden="true" />

        <div className="stack">
          <div className="cosHudRow">
            <label>{t('simulationHorizonForecast', language)} <span className="cosChip sim-value-pill">{horizonMonths} {t('simulationMonthsShort', language)}</span>
              <input type="range" min={6} max={30} value={horizonMonths} onChange={(e) => setHorizonMonths(Number(e.target.value))} />
              <small>{t('simulationHorizonHelper', language)}</small>
            </label>
            <label>{t('simulationThresholdGoal', language)} <span className="cosChip sim-value-pill">{successThreshold}</span>
              <input type="range" min={80} max={180} step={1} value={successThreshold} onChange={(e) => setSuccessThreshold(Number(e.target.value))} />
              <small>{t('simulationThresholdGoalHelper', language)}</small>
            </label>
          </div>

          <div className="cosHudRow">
            <label>{t('simulationFogLabel', language)} <span className="cosChip sim-value-pill">{t(`simulationUncertaintyLevel${uncertaintyLevel + 1}` as never, language)}</span> <span title={t('simulationUncertaintyTooltip', language)} className="sim-help-dot">?</span>
              <input type="range" min={0} max={4} step={1} value={uncertaintyLevel} onChange={(e) => setUncertainty(DISCRETE_LEVEL_VALUES[Number(e.target.value)])} />
              <small>{t('simulationFogHelper', language)} {t(uncertaintyEffectKey(uncertaintyLevel), language)}</small>
            </label>
            <label>{t('simulationCourageLabel', language)} <span className="cosChip sim-value-pill">{t(`simulationRiskLevel${riskLevel + 1}` as never, language)}</span> <span title={t('simulationRiskTooltip', language)} className="sim-help-dot">?</span>
              <input type="range" min={0} max={4} step={1} value={riskLevel} onChange={(e) => setRiskAppetite(DISCRETE_LEVEL_VALUES[Number(e.target.value)])} />
              <small>{t('simulationCourageHelper', language)} {t(riskEffectKey(riskLevel), language)}</small>
            </label>
          </div>

          <div className="cosHudRow">
            <label>{t('simulationStrategy', language)}
              <select value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyMode)}>
                <option value="attack">{t('strategyAttack', language)}</option>
                <option value="balance">{t('strategyBalance', language)}</option>
                <option value="defense">{t('strategyDefense', language)}</option>
              </select>
            </label>
            <label className="sim-black-swan-control">
              <span>
                <input type="checkbox" checked={blackSwanEnabled} onChange={(e) => setBlackSwanEnabled(e.target.checked)} />
                {t('simulationBlackSwanLabel', language)}
              </span>
              <small>{t('simulationBlackSwanHelper', language)}</small>
              <span className={`cosChip sim-hazard-chip${blackSwanEnabled ? ' is-active' : ''}`} title={`${t('simulationBlackSwanTooltipTitle', language)} ${t('simulationBlackSwanTooltipBody', language)}`}>☄ {blackSwanEnabled ? t('simulationHazardChipOn', language) : t('simulationHazardChipOff', language)}</span>
            </label>
          </div>
          <div className="preset-row">
            <button className="cosBtn" onClick={startSimulation}>{isRunning ? t('simulationRunning', language) : t('simulationRun', language)}</button>
            <button className="cosBtn cosBtn--ghost" onClick={saveCurrentTemplate}>{t('simulationSaveTemplate', language)}</button>
            <button className="cosBtn cosBtn--ghost" onClick={() => applyPreset('stabilize')}>{t('simulationReset', language)}</button>
          </div>
          {templates.length > 0 && <div className="preset-row sim-templates-row">{templates.slice(0, 3).map((template) => <button className="cosBtn cosBtn--ghost" key={template.id} onClick={() => applyTemplate(template)}>{template.name}</button>)}</div>}
          {isRunning && <p>{t('simulationProgress', language)}: {Math.round(progress * 100)}%</p>}
        </div>

      {result && (
        <>
          <div className="cosDivider" aria-hidden="true" />
          <div className="cosOracleFrame stack">
            <div className="sim-chart-head">
              <strong>{t('simulationOracleScreen', language)}</strong>
              {tooltip && <span className="cosChip">{t('simulationPinnedMonthBadge', language)} {tooltip.month}</span>}
            </div>
            <UPlotChart
              data={fanData}
              series={fanSeries}
              kind="time-series"
              reducedMotion={reducedMotion}
              ariaLabel={t('simulationTrajectoryTitle', language)}
              showLegend={false}
              className="sim-oracle-frame"
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
            <p className="sim-legend-hint">{t('simulationChartMeaningLine1', language)}</p>
            <p className="sim-legend-hint">{t('simulationChartMeaningLine2', language)}</p>
            <p className="sim-legend-hint">{t('simulationChartHintTapPin', language)}</p>
            <div className="sim-legend-row">
              <span className="cosChip"><i className="chip bad" />{t('scenarioBad', language)}{tooltip ? `: ${Math.round(tooltip.point.p10)}` : ''}</span>
              <span className="cosChip"><i className="chip typical" />{t('scenarioTypical', language)}{tooltip ? `: ${Math.round(tooltip.point.p50)}` : ''}</span>
              <span className="cosChip"><i className="chip good" />{t('scenarioGood', language)}{tooltip ? `: ${Math.round(tooltip.point.p90)}` : ''}</span>
              <span className="cosChip sim-threshold-chip"><i className="chip threshold" />{t('simulationThreshold', language)} {successThreshold}</span>
            </div>
            {tooltip && (
              <div className="sim-tooltip">
                <strong>{t('simulationTooltipMonth', language)} {tooltip.month}</strong>
                {pinnedIndex != null && <span className="sim-pinned-pill">{t('simulationPinnedMonth', language)} {tooltip.month}</span>}
                <p>{t('scenarioBad', language)}: {Math.round(tooltip.point.p10)}</p>
                <p>{t('scenarioTypical', language)}: {Math.round(tooltip.point.p50)}</p>
                <p>{t('scenarioGood', language)}: {Math.round(tooltip.point.p90)}</p>
              </div>
            )}
          </div>

          <div className="cosDivider" aria-hidden="true" />
          <details className="stack sim-details" open>
            <summary>{t('simulationDetails', language)}</summary>
            <strong>{t('simulationTopLevers', language)}</strong>
            <ol>
              {topStrategicLevers.map((lever, index) => (
                <li key={`${lever.labelKey}-${lever.score}`}>
                  {t(strategicLeverTitleKey(index), language)} {t(lever.labelKey as never, language)} · {t('simulationLeverSuccessDelta', language)} {lever.successDelta >= 0 ? '+' : ''}{lever.successDelta}/10 · {t('simulationLeverDrawdownDelta', language)} {lever.drawdownDelta >= 0 ? '+' : ''}{lever.drawdownDelta}%
                </li>
              ))}
            </ol>
            {riskSummary && (
              <>
                <strong>{t('simulationRiskEvents', language)}</strong>
                <p>{t('simulationStressBreaks', language)}: {Math.round(riskSummary.stressBreaks.shareOfWorldsPct)}% {t('simulationWorldsSuffix', language)} ({riskSummary.stressBreaks.worldsWithEvent}/{result.runs}) · {riskSummary.stressBreaks.avgPerWorld.toFixed(1)} {t('simulationEventsPerWorld', language)}</p>
                <p>{t('simulationDrawdowns', language)}: {Math.round(riskSummary.drawdownsOver20.shareOfWorldsPct)}% {t('simulationWorldsSuffix', language)} ({riskSummary.drawdownsOver20.worldsWithEvent}/{result.runs}) · {riskSummary.drawdownsOver20.avgPerWorld.toFixed(1)} {t('simulationEventsPerWorld', language)}</p>
                <p>{t('simulationBlackSwansCount', language)}: {Math.round(riskSummary.blackSwans.shareOfWorldsPct)}% {t('simulationWorldsSuffix', language)} ({riskSummary.blackSwans.worldsWithEvent}/{result.runs}) · {riskSummary.blackSwans.avgPerWorld.toFixed(1)} {t('simulationEventsPerWorld', language)} · {t('simulationBlackSwanWorldsHit', language)}: {Math.round(riskSummary.blackSwans.shareOfWorldsPct)}% · {t('simulationBlackSwanHitsPerWorld', language)}: {riskSummary.blackSwans.avgPerWorld.toFixed(1)}</p>
              </>
            )}

            <strong>{t('simulationHistogramTitle', language)}</strong>
            <div className="sim-histogram" role="img" aria-label={t('simulationHistogramTitle', language)}>
              {histogram?.map((height, index) => (
                <div key={index} className="sim-bar" style={{ height: `${height}%` }} />
              ))}
            </div>
          </details>

          <details className="stack sim-details">
            <summary>{t('simulationAdvanced', language)}</summary>
            <p><code>{t('simulationRawMedian', language)}: {Math.round(result.scorePercentiles.p50)}</code></p>
            <p><code>{t('simulationRawP10', language)}: {Math.round(result.scorePercentiles.p10)}</code></p>
            <p><code>{t('simulationRawP90', language)}: {Math.round(result.scorePercentiles.p90)}</code></p>
            <p><code>{t('simulationRawUncertainty', language)}: {uncertainty.toFixed(2)}</code></p>
            <p><code>{t('simulationRawRiskAppetite', language)}: {riskAppetite.toFixed(2)}</code></p>
          </details>

          <div className="cosDivider" aria-hidden="true" />
          <div className="stack">
            <div className="preset-row">
              <button className="cosBtn cosBtn--ghost" onClick={() => { if (result) { saveBaseline({ label: new Date().toLocaleTimeString(), result: { scoreTrajectory: result.scoreTrajectory, horizonMonths: result.horizonMonths, runs: result.runs }, savedAtISO: new Date().toISOString() }); setBaseline(loadBaseline()); } }}>{t('simulationCompare', language)}</button>
            </div>
          </div>
        </>
      )}
      </div>
    </section>
  );
}
