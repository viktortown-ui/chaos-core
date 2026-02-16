import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { SimulationResult, StrategyMode } from '../../../core/sim/types';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { Language, t } from '../../../shared/i18n';
import { loadSimTemplates, saveBaseline, saveSimTemplate, SimTemplate } from '../../../shared/storage/simStorage';
import { SensitivityItem, SimConfigPayload, SimWorkerResponse } from '../worker/protocol';
import { buildDrivers, buildFanPoints, buildHeadroomChipModel, buildOraclePins, buildRiskDisplayMetric, buildSpreadChipModel, DISCRETE_LEVEL_VALUES, DriverInsight, FanPoint, findFailureWindow, formatAdaptive, formatSignedPercent, formatSignedTenthsAsPercent, heroStatusLabel, nearestDiscreteLevel, predictabilityIndexFromSpread, rankLevers, riskCostLineKey, riskEffectKey, strategicLeverTitleKey, successMeterLabel, uncertaintyEffectKey } from './simulationViewModel';

type ScenarioKey = 'layoff' | 'wedding' | 'deal' | 'mortgage' | 'relocation' | 'custom';
type ObjectiveKey = 'finance' | 'energy' | 'composite' | 'scenario';

interface ScenarioPreset {
  key: ScenarioKey;
  strategy: StrategyMode;
  horizonMonths: number;
  uncertainty: number;
  riskAppetite: number;
  blackSwanEnabled: boolean;
  threshold: number;
  tradeoffKey: 'tradeoffBoost' | 'tradeoffStabilize' | 'tradeoffStorm' | 'tradeoffFocus' | 'tradeoffDiversify';
  icon: string;
  objective: ObjectiveKey;
}

const scenarioPresets: ScenarioPreset[] = [
  { key: 'layoff', strategy: 'defense', horizonMonths: 12, uncertainty: 0.8, riskAppetite: 0.2, blackSwanEnabled: true, threshold: 108, tradeoffKey: 'tradeoffStorm', icon: '🧯', objective: 'finance' },
  { key: 'wedding', strategy: 'balance', horizonMonths: 18, uncertainty: 0.4, riskAppetite: 0.4, blackSwanEnabled: false, threshold: 122, tradeoffKey: 'tradeoffStabilize', icon: '💍', objective: 'composite' },
  { key: 'deal', strategy: 'attack', horizonMonths: 9, uncertainty: 0.6, riskAppetite: 0.8, blackSwanEnabled: true, threshold: 138, tradeoffKey: 'tradeoffBoost', icon: '🤝', objective: 'scenario' },
  { key: 'mortgage', strategy: 'balance', horizonMonths: 24, uncertainty: 0.5, riskAppetite: 0.3, blackSwanEnabled: true, threshold: 118, tradeoffKey: 'tradeoffFocus', icon: '🏠', objective: 'finance' },
  { key: 'relocation', strategy: 'balance', horizonMonths: 16, uncertainty: 0.7, riskAppetite: 0.5, blackSwanEnabled: true, threshold: 120, tradeoffKey: 'tradeoffDiversify', icon: '🚚', objective: 'energy' }
];

const runsCount = 10_000;

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

type ChartMode = 'line' | 'fan' | 'cloud';

interface ActionCompare {
  source: 'lever' | 'quest';
  title: string;
  beforeChance: number;
  afterChance: number;
  beforeHeadroom: number;
  afterHeadroom: number;
}

function BottomSheetHelp({ title, lines, onClose, language }: { title: string; lines: string[]; onClose: () => void; language: Language }) {
  return (
    <div className="sim-bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sim-bottom-sheet__backdrop" onClick={onClose} aria-label={t('simulationHelpClose', language)} />
      <div className="sim-bottom-sheet__panel stack">
        <strong>{title}</strong>
        <ul>
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <button type="button" className="cosBtn cosBtn--ghost" onClick={onClose}>{t('simulationHelpClose', language)}</button>
      </div>
    </div>
  );
}

function OracleCanvas({
  fanPoints,
  threshold,
  pinnedMonths,
  reducedMotion,
  ariaLabel,
  pinLabel,
  mode,
  language
}: {
  fanPoints: FanPoint[];
  threshold: number;
  pinnedMonths: number[];
  reducedMotion: boolean;
  ariaLabel: string;
  pinLabel: string;
  mode: ChartMode;
  language: Language;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fanPoints.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.fillRect !== 'function') return;

    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = canvas.clientWidth || 900;
    const height = 320;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const pad = { top: 24, right: 14, bottom: 34, left: 14 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const values = fanPoints.flatMap((point) => [point.p10, point.p50, point.p90]);
    values.push(threshold);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const toX = (index: number) => pad.left + (index / Math.max(1, fanPoints.length - 1)) * chartW;
    const toY = (value: number) => pad.top + (1 - (value - min) / span) * chartH;

    const draw = (time = 0) => {
      ctx.clearRect(0, 0, width, height);
      const bg = typeof ctx.createLinearGradient === 'function' ? ctx.createLinearGradient(0, 0, 0, height) : null;
      if (bg) {
        bg.addColorStop(0, 'rgba(14,31,56,0.92)');
        bg.addColorStop(1, 'rgba(8,18,32,0.92)');
        ctx.fillStyle = bg;
      } else {
        ctx.fillStyle = 'rgba(10, 22, 40, 0.95)';
      }
      ctx.fillRect(0, 0, width, height);

      if (mode !== 'line') {
        ctx.beginPath();
        fanPoints.forEach((point, index) => {
          const x = toX(index);
          const y = toY(point.p90);
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        for (let index = fanPoints.length - 1; index >= 0; index -= 1) {
          const x = toX(index);
          const y = toY(fanPoints[index].p10);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        const coneFill = typeof ctx.createLinearGradient === 'function' ? ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH) : null;
        if (coneFill) {
          if (mode === 'cloud') {
            coneFill.addColorStop(0, 'rgba(130,170,255,0.36)');
            coneFill.addColorStop(1, 'rgba(88,130,199,0.04)');
          } else {
            coneFill.addColorStop(0, 'rgba(71,153,255,0.32)');
            coneFill.addColorStop(1, 'rgba(71,153,255,0.08)');
          }
          ctx.fillStyle = coneFill;
        } else {
          ctx.fillStyle = 'rgba(71,153,255,0.16)';
        }
        ctx.fill();
      }

      const drawLine = (extractor: (point: FanPoint) => number, color: string, widthPx: number, dash: number[] = []) => {
        ctx.beginPath();
        fanPoints.forEach((point, index) => {
          const x = toX(index);
          const y = toY(extractor(point));
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = widthPx;
        ctx.setLineDash(dash);
        ctx.stroke();
      };

      drawLine((point) => point.p10, '#ff9f95', 1.8, mode === 'line' ? [7, 5] : []);
      drawLine((point) => point.p50, '#89ffd2', 2.8);
      drawLine((point) => point.p90, '#8ec5ff', 1.8, mode === 'line' ? [7, 5] : []);

      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.moveTo(pad.left, toY(threshold));
      ctx.lineTo(pad.left + chartW, toY(threshold));
      ctx.strokeStyle = '#ff6f7d';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      pinnedMonths.forEach((monthIndex) => {
        const clampedIndex = Math.max(0, Math.min(fanPoints.length - 1, monthIndex));
        const x = toX(clampedIndex);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + chartH);
        ctx.strokeStyle = 'rgba(212,230,255,0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(235,244,255,0.9)';
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${pinLabel} ${fanPoints[clampedIndex].month}`, x, height - 10);
      });

      if (activeIndex != null) {
        const index = Math.max(0, Math.min(fanPoints.length - 1, activeIndex));
        const x = toX(index);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + chartH);
        ctx.strokeStyle = '#f7d388';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (!reducedMotion) {
        const phase = time / 420;
        [0, 1, 2].forEach((lane) => {
          const progress = (phase * (0.2 + lane * 0.12)) % 1;
          const pointIndex = Math.floor(progress * (fanPoints.length - 1));
          const nextIndex = Math.min(fanPoints.length - 1, pointIndex + 1);
          const mix = progress * (fanPoints.length - 1) - pointIndex;
          const x = toX(pointIndex) + (toX(nextIndex) - toX(pointIndex)) * mix;
          const lineVal = lane === 0 ? fanPoints[nextIndex].p10 : lane === 1 ? fanPoints[nextIndex].p50 : fanPoints[nextIndex].p90;
          const y = toY(lineVal);
          ctx.fillStyle = lane === 1 ? 'rgba(137,255,210,0.9)' : 'rgba(151,200,255,0.76)';
          ctx.beginPath();
          ctx.arc(x, y, lane === 1 ? 2.2 : 1.7, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    };

    draw();
    if (reducedMotion) return;
    let frame = 0;
    const tick = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, fanPoints, mode, pinnedMonths, reducedMotion, threshold, pinLabel]);

  const onMove = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || fanPoints.length === 0) return;
    const bounds = canvas.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
    const nextIndex = Math.round((relativeX / Math.max(1, bounds.width)) * (fanPoints.length - 1));
    setActiveIndex(nextIndex);
  };

  const activePoint = activeIndex == null ? null : fanPoints[Math.max(0, Math.min(fanPoints.length - 1, activeIndex))];

  return (
    <div className="oracle-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="oracle-canvas"
        role="img"
        aria-label={ariaLabel}
        onPointerDown={(event) => onMove(event.clientX)}
        onPointerMove={(event) => {
          if (event.pointerType === 'mouse' && (event.buttons & 1) !== 1) return;
          onMove(event.clientX);
        }}
        onPointerLeave={() => setActiveIndex(null)}
      />
      {activePoint && (
        <div className="oracle-canvas-tooltip" role="status" aria-live="polite">
          <strong>{pinLabel} {activePoint.month}</strong>
          <p>{t('scenarioBad', language)}: {formatAdaptive(activePoint.p10)}</p>
          <p>{t('scenarioTypical', language)}: {formatAdaptive(activePoint.p50)}</p>
          <p>{t('scenarioGood', language)}: {formatAdaptive(activePoint.p90)}</p>
        </div>
      )}
    </div>
  );
}


function OutcomeSummary({
  language,
  successRatio,
  runs,
  threshold,
  horizonMonths,
  failureWindow,
  scoreP50
}: {
  language: Language;
  successRatio: number;
  runs: number;
  threshold: number;
  horizonMonths: number;
  failureWindow: { fromMonth: number; toMonth: number } | null;
  scoreP50: number;
}) {
  const successWorlds = Math.round(successRatio * runs);
  const pct = Math.round(successRatio * 100);
  const verdictKey = scoreP50 >= threshold ? 'simulationOutcomeVerdictPass' : 'simulationOutcomeVerdictFail';
  return (
    <section className="oracle-outcome stack" aria-label={t('simulationOutcomeTitle', language)}>
      <strong>{t('simulationOutcomeTitle', language)}: {t(verdictKey, language)}</strong>
      <p>{t('simulationOutcomeSuccessRule', language)}: {t('simulationOutcomeMetricName', language)} ≥ {formatAdaptive(threshold)} · {horizonMonths} {t('simulationMonthsShort', language)}</p>
      <p>{t('simulationOutcomeFrequency', language)}: {successWorlds} {t('simulationOutcomeOutOf', language)} {runs} {t('simulationWorldsSuffix', language)} (= {pct}%)</p>
      <p>{t('simulationOutcomeBreakpoint', language)}: {failureWindow ? `${failureWindow.fromMonth}–${failureWindow.toMonth} ${t('simulationMonthsShort', language)}` : t('simulationOutcomeBreakpointNone', language)}</p>
    </section>
  );
}

function DriversList({ language, drivers }: { language: Language; drivers: DriverInsight[] }) {
  return (
    <section className="oracle-drivers stack" aria-label={t('simulationDriversTitle', language)}>
      <strong>{t('simulationDriversTitle', language)}</strong>
      {drivers.map((driver) => (
        <article key={driver.key} className="oracle-driver-item">
          <p><b>{t(driver.titleKey, language)}</b> — {t(driver.summaryKey, language)}</p>
          <small>{t('simulationDriversStrength', language)}: {t(driver.strengthKey, language)} · {driver.indicator}</small>
        </article>
      ))}
    </section>
  );
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
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>('wedding');
  const [objective, setObjective] = useState<ObjectiveKey>('composite');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [templates, setTemplates] = useState<SimTemplate[]>([]);
  const [sensitivity, setSensitivity] = useState<SensitivityItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [isRunning, setRunning] = useState(false);
  const [heroPulse, setHeroPulse] = useState(false);
  const [needsRecalc, setNeedsRecalc] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<3 | 6 | 12 | 24 | 'all'>('all');
  const [chartMode, setChartMode] = useState<ChartMode>('fan');
  const [isQuestOpen, setQuestOpen] = useState(false);
  const [helpSheet, setHelpSheet] = useState<'chart' | 'scenarios' | null>(null);
  const [actionCompare, setActionCompare] = useState<ActionCompare | null>(null);

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
        setNeedsRecalc(false);
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

  const markDirty = () => setNeedsRecalc(true);

  const startSimulation = () => {
    const worker = workerRef.current;
    if (!worker) return;
    setRunning(true);
    setNeedsRecalc(false);
    setProgress(0);
    const requestId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeIdRef.current = requestId;
    worker.postMessage({ type: 'start', id: requestId, config: buildConfig() });

    const sensitivityId = `sens-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeSensitivityIdRef.current = sensitivityId;
    worker.postMessage({ type: 'sensitivity', id: sensitivityId, config: buildConfig() });
  };

  const applyScenarioPreset = (scenarioKey: ScenarioKey) => {
    if (scenarioKey === "custom") {
      setSelectedScenario("custom");
      markDirty();
      return;
    }
    const preset = scenarioPresets.find((item) => item.key === scenarioKey);
    if (!preset) return;
    setSelectedScenario(scenarioKey);
    setObjective(preset.objective);
    setHorizonMonths(preset.horizonMonths);
    setUncertainty(preset.uncertainty);
    setRiskAppetite(preset.riskAppetite);
    setStrategy(preset.strategy);
    setBlackSwanEnabled(preset.blackSwanEnabled);
    setSuccessThreshold(preset.threshold);
    markDirty();
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
    markDirty();
  };

  const applyLever = (lever: SensitivityItem) => {
    const cfg = lever.nextConfig;
    const beforeChance = result ? Math.round(result.successRatio * 100) : 0;
    const beforeHeadroom = result ? Math.round(result.scorePercentiles.p50 - successThreshold) : 0;
    if (typeof cfg.horizonMonths === 'number') setHorizonMonths(cfg.horizonMonths);
    if (typeof cfg.riskAppetite === 'number') setRiskAppetite(cfg.riskAppetite);
    if (typeof cfg.successThreshold === 'number') setSuccessThreshold(cfg.successThreshold);
    if (cfg.strategy) setStrategy(cfg.strategy);
    pulseAndVibrate(() => setHeroPulse(true), reducedMotion);
    if (result) {
      setActionCompare({
        source: 'lever',
        title: t(lever.labelKey as never, language),
        beforeChance,
        afterChance: Math.max(0, Math.min(100, Math.round(beforeChance + lever.successDelta))),
        beforeHeadroom,
        afterHeadroom: beforeHeadroom + Math.round(lever.successDelta / 2)
      });
    }
    markDirty();
  };

  const applyBestLever = () => {
    const best = sensitivity[0];
    if (!best) return;
    applyLever(best);
  };

  const fanPoints = useMemo(() => buildFanPoints(result?.scoreTrajectory ?? [], horizonMonths), [horizonMonths, result]);

  const selectedTradeoff = scenarioPresets.find((preset) => preset.key === selectedScenario)?.tradeoffKey ?? 'tradeoffStabilize';

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

  const filteredFanPoints = useMemo(() => {
    if (chartPeriod === 'all') return fanPoints;
    return fanPoints.filter((point) => point.month <= chartPeriod);
  }, [chartPeriod, fanPoints]);

  const oraclePins = useMemo(() => buildOraclePins(filteredFanPoints.length, null), [filteredFanPoints.length]);

  const successWorlds = result ? Math.round(result.successRatio * result.runs) : 0;
  const failureWindow = useMemo(() => findFailureWindow(filteredFanPoints, successThreshold, horizonMonths), [filteredFanPoints, horizonMonths, successThreshold]);
  const drivers = useMemo(() => buildDrivers(topStrategicLevers), [topStrategicLevers]);

  const spreadValue = result ? Math.round(result.scorePercentiles.p90 - result.scorePercentiles.p10) : 0;
  const predictability = predictabilityIndexFromSpread(spreadValue);
  const rawMedianScore = result ? Math.round(result.scorePercentiles.p50) : 0;
  const levelScore = Math.max(0, Math.min(100, rawMedianScore));
  const kpiMetrics = result ? [
    {
      labelKey: 'simulationKpiGoalChance',
      value: `${Math.round(result.successRatio * 100)}%`,
      hintKey: 'simulationKpiGoalChanceHint'
    },
    {
      labelKey: 'simulationKpiMedian',
      value: formatAdaptive(result.scorePercentiles.p50),
      hintKey: 'simulationKpiMedianHint'
    },
    {
      labelKey: 'simulationKpiWorst10',
      value: formatAdaptive(result.scorePercentiles.p10),
      hintKey: 'simulationKpiWorst10Hint'
    },
    {
      labelKey: 'simulationKpiBest10',
      value: formatAdaptive(result.scorePercentiles.p90),
      hintKey: 'simulationKpiBest10Hint'
    },
    {
      labelKey: 'simulationKpiFailureWindow',
      value: failureWindow ? `${failureWindow.fromMonth}–${failureWindow.toMonth} ${t('simulationMonthsShort', language)}` : t('simulationOutcomeBreakpointNone', language),
      hintKey: 'simulationKpiFailureWindowHint'
    },
    {
      labelKey: 'simulationKpiRiskPrice',
      value: `${Math.round(spreadValue)}`,
      hintKey: 'simulationKpiRiskPriceHint'
    },
    {
      labelKey: 'simulationOracleKpiPredictability',
      value: `${predictability}/100`,
      hintKey: 'simulationOracleKpiPredictabilityHint'
    }
  ] : [];;
  const uncertaintyLevel = nearestDiscreteLevel(uncertainty);
  const riskLevel = nearestDiscreteLevel(riskAppetite);

  const makeQuest = () => {
    setQuestOpen(true);
  };

  const createQuestStub = () => {
    const summary = `${t('simulationQuestPrefix', language)}: ${t('simulationThreshold', language)} ${successThreshold}, ${t('simulationHorizon', language)} ${horizonMonths}`;
    const beforeChance = result ? Math.round(result.successRatio * 100) : 0;
    const beforeHeadroom = result ? Math.round(result.scorePercentiles.p50 - successThreshold) : 0;
    const nextThreshold = Math.max(80, successThreshold - 5);
    const nextUncertainty = Math.max(0.2, uncertainty - 0.2);
    setData((current) => ({
      ...current,
      history: [{ id: `quest-${Date.now()}`, kind: 'quest', note: summary, atISO: new Date().toISOString() }, ...current.history]
    }));
    setSuccessThreshold(nextThreshold);
    setUncertainty(nextUncertainty);
    setActionCompare({
      source: 'quest',
      title: t('simulationQuestCompareTitle', language),
      beforeChance,
      afterChance: Math.max(0, Math.min(100, beforeChance + 4)),
      beforeHeadroom,
      afterHeadroom: beforeHeadroom + 5
    });
    setQuestOpen(false);
    markDirty();
  };

  return (
    <section className={`stack sim-screen cosmos-hud${reducedMotion ? ' reduce-motion' : ''}`}>
      <div className="simBackdrop" aria-hidden="true" />
      <h2>{t('simulationTitle', language)}</h2>
      <div className="cosShell stack">
        <h3 className="sim-section-title">{t('simulationSectionMission', language)}</h3>
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
                  <p className="sim-hero-gap">{`${t('simulationNeedToGoal', language)} ${thresholdHeadroom == null ? 0 : thresholdHeadroom}`}</p>
                  <p className="sim-hero-gap">{t('simulationLevelLabel', language)}: {levelScore}/100</p>
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
              {actionCompare && (
                <div className="oracle-compare">
                  <strong>{t('simulationBeforeAfterTitle', language)} · {actionCompare.title}</strong>
                  <p>{t('simulationExpectedEffectChance', language)}: {actionCompare.beforeChance}% → {actionCompare.afterChance}%</p>
                  <p>{t('simulationNeedToGoal', language)}: {Math.max(0, -actionCompare.beforeHeadroom)} → {Math.max(0, -actionCompare.afterHeadroom)}</p>
                </div>
              )}
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
            {[...scenarioPresets, { key: "custom", icon: "➕" } as const].map((preset) => (
              <button key={preset.key} className={`cosBtn cosBtn--ghost sim-dock-btn${selectedScenario === preset.key ? ' sim-dock-btn-active' : ''}`} onClick={() => applyScenarioPreset(preset.key as ScenarioKey)}>
                <span aria-hidden="true">{preset.icon}</span>
                <span>{t(`simulationScenario_${preset.key}` as never, language)}</span>
              </button>
            ))}
          </div>
          <p>{t('simulationTradeoff', language)}: {t(selectedTradeoff, language)}</p>
          <label>{t('simulationObjectiveSelector', language)}
            <select value={objective} onChange={(e) => { setObjective(e.target.value as ObjectiveKey); markDirty(); }}>
              <option value="finance">{t('simulationObjective_finance', language)}</option>
              <option value="energy">{t('simulationObjective_energy', language)}</option>
              <option value="composite">{t('simulationObjective_composite', language)}</option>
              <option value="scenario">{t('simulationObjective_scenario', language)}</option>
            </select>
          </label>
        </div>

        <div className="cosDivider" aria-hidden="true" />

        <h3 className="sim-section-title">{t('simulationSectionLaunch', language)}</h3>
        <div className="stack">
          <div className="cosHudRow">
            <label>{t('simulationHorizonForecast', language)} <span className="cosChip sim-value-pill">{horizonMonths} {t('simulationMonthsShort', language)}</span>
              <input type="range" min={6} max={30} value={horizonMonths} onChange={(e) => { setHorizonMonths(Number(e.target.value)); markDirty(); }} />
              <small>{t('simulationHorizonHelper', language)}</small>
            </label>
            <label>{t('simulationThresholdGoal', language)} <span className="cosChip sim-value-pill">{successThreshold}</span>
              <input type="range" min={80} max={180} step={1} value={successThreshold} onChange={(e) => { setSuccessThreshold(Number(e.target.value)); markDirty(); }} />
              <small>{t('simulationThresholdGoalHelper', language)}</small>
            </label>
          </div>

          <div className="cosHudRow">
            <label>{t('simulationFogLabel', language)} <span className="cosChip sim-value-pill">{t(`simulationUncertaintyLevel${uncertaintyLevel + 1}` as never, language)}</span>
              <input type="range" min={0} max={4} step={1} value={uncertaintyLevel} onChange={(e) => { setUncertainty(DISCRETE_LEVEL_VALUES[Number(e.target.value)]); markDirty(); }} />
              <small>{t('simulationFogHelper', language)} {t(uncertaintyEffectKey(uncertaintyLevel), language)}</small>
            </label>
            <label>{t('simulationCourageLabel', language)} <span className="cosChip sim-value-pill">{t(`simulationRiskLevel${riskLevel + 1}` as never, language)}</span>
              <input type="range" min={0} max={4} step={1} value={riskLevel} onChange={(e) => { setRiskAppetite(DISCRETE_LEVEL_VALUES[Number(e.target.value)]); markDirty(); }} />
              <small>{t('simulationCourageHelper', language)} {t(riskEffectKey(riskLevel), language)}</small>
            </label>
          </div>

          <div className="cosHudRow">
            <label>{t('simulationStrategy', language)}
              <select value={strategy} onChange={(e) => { setStrategy(e.target.value as StrategyMode); markDirty(); }}>
                <option value="attack">{t('strategyAttack', language)}</option>
                <option value="balance">{t('strategyBalance', language)}</option>
                <option value="defense">{t('strategyDefense', language)}</option>
              </select>
            </label>
            <label className="sim-black-swan-control">
              <span>
                <input type="checkbox" checked={blackSwanEnabled} onChange={(e) => { setBlackSwanEnabled(e.target.checked); markDirty(); }} />
                {t('simulationBlackSwanRealityLabel', language)}
              </span>
              <small>{t('simulationBlackSwanRealityHelper', language)}</small>
              {blackSwanEnabled && riskSummary && (
                <span className="cosChip sim-hazard-chip is-active" title={`${t('simulationBlackSwanTooltipTitle', language)} ${t('simulationBlackSwanTooltipBody', language)}`}>
                  ☄ {t('simulationHazardChipOn', language)} · {Math.round(riskSummary.blackSwans.shareOfWorldsPct)}% / {riskSummary.blackSwans.avgPerWorld.toFixed(1)}
                </span>
              )}
            </label>
          </div>
          <div className="preset-row">
            <button className="cosBtn" onClick={startSimulation}>{isRunning ? t('simulationRunning', language) : needsRecalc ? t('simulationRecalculate', language) : t('simulationRun', language)}</button>
            <button className="cosBtn cosBtn--ghost" onClick={saveCurrentTemplate}>{t('simulationSaveTemplate', language)}</button>
            <button className="cosBtn cosBtn--ghost" onClick={() => applyScenarioPreset('wedding')}>{t('simulationReset', language)}</button>
          </div>
          {templates.length > 0 && <div className="preset-row sim-templates-row">{templates.slice(0, 3).map((template) => <button className="cosBtn cosBtn--ghost" key={template.id} onClick={() => applyTemplate(template)}>{template.name}</button>)}</div>}
          {isRunning && <p>{t('simulationProgress', language)}: {Math.round(progress * 100)}%</p>}
        </div>

      {result && (
        <>
          <div className="cosDivider" aria-hidden="true" />
          <h3 className="sim-section-title">{t('simulationSectionVerdict', language)}</h3>
          <section className="oracle-theater stack oracle-stage" aria-label={t('simulationOracleTheater', language)}>
            <div className="sim-chart-head">
              <strong>{t('simulationOracleStageTitle', language)}</strong>
              <span className="cosChip">{t('simulationOracleStageSub', language)}</span>
            </div>
            <div className="oracle-chart-toolbar">
              <div className="oracle-period-switch">
                {([3, 6, 12, 24, 'all'] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={`cosBtn cosBtn--ghost${chartPeriod === period ? ' sim-dock-btn-active' : ''}`}
                    onClick={() => setChartPeriod(period)}
                  >
                    {period === 'all' ? t('simulationPeriodAll', language) : `${period}${t('simulationMonthsShort', language)}`}
                  </button>
                ))}
              </div>
              <div className="oracle-mode-switch">
                {(['line', 'fan', 'cloud'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`cosBtn cosBtn--ghost${chartMode === mode ? ' sim-dock-btn-active' : ''}`}
                    onClick={() => setChartMode(mode)}
                  >
                    {t((mode === 'line' ? 'simulationChartModeLine' : mode === 'fan' ? 'simulationChartModeFan' : 'simulationChartModeCloud') as never, language)}
                  </button>
                ))}
              </div>
            </div>

            <OutcomeSummary
              language={language}
              successRatio={result.successRatio}
              runs={result.runs}
              threshold={successThreshold}
              horizonMonths={horizonMonths}
              failureWindow={failureWindow}
              scoreP50={result.scorePercentiles.p50}
            />
            <OracleCanvas
              fanPoints={filteredFanPoints}
              threshold={successThreshold}
              pinnedMonths={oraclePins}
              reducedMotion={reducedMotion}
              ariaLabel={t('simulationTrajectoryTitle', language)}
              pinLabel={t('simulationTooltipMonth', language)}
              mode={chartMode}
              language={language}
            />
            <div className="oracle-help-row">
              <button type="button" className="cosBtn cosBtn--ghost" onClick={() => setHelpSheet('chart')}>{t('simulationHowToReadTitle', language)}</button>
              <button type="button" className="cosBtn cosBtn--ghost" onClick={() => setHelpSheet('scenarios')}>{t('simulationScenarioMeaningTitle', language)}</button>
            </div>
            <div className="oracle-kpi-strip">
              {kpiMetrics.map((metric) => (
                <article key={metric.labelKey} className="oracle-kpi-chip">
                  <small>{t(metric.labelKey as never, language)}</small>
                  <strong>{metric.value}</strong>
                  <p>{t(metric.hintKey as never, language)}</p>
                </article>
              ))}
            </div>
            <h4 className="sim-section-title">{t('simulationSectionDrivers', language)}</h4>
            <DriversList language={language} drivers={drivers} />

            <h4 className="sim-section-title">{t('simulationSectionLevers', language)}</h4>

            <div className="lever-cards-grid oracle-command-grid">
              {topStrategicLevers.map((lever, index) => {
                const nextSuccessWorlds = Math.max(0, Math.min(result.runs, successWorlds + Math.round((lever.successDelta / 100) * result.runs)));
                const nextSuccessPct = Math.max(0, Math.min(100, Math.round(result.successRatio * 100 + lever.successDelta)));
                return (
                <article key={`${lever.labelKey}-${lever.score}`} className="oracle-lever-card">
                  <strong>{t(strategicLeverTitleKey(index), language)}</strong>
                  <p className="oracle-command-line">{t('simulationOracleDo', language)}: {t(lever.labelKey as never, language)}</p>
                  <p className="oracle-command-impact">{t('simulationOracleEffect', language)}: {t('simulationLeverSuccessDelta', language)} {formatSignedTenthsAsPercent(lever.successDelta)} · {t('simulationLeverDrawdownDelta', language)} {formatSignedPercent(lever.drawdownDelta)}</p>
                  <p className="oracle-command-impact">{t('simulationExpectedEffect', language)}: {t('simulationExpectedEffectChance', language)} {Math.round(result.successRatio * 100)}% → {nextSuccessPct}% · {t('simulationExpectedEffectWorlds', language)} {successWorlds} → {nextSuccessWorlds}</p>
                  <button className="cosBtn cosBtn--ghost" onClick={() => applyLever(lever)}>{t('simulationApplyLever', language)}</button>
                </article>
              );})}
            </div>
          </section>

          <h3 className="sim-section-title">{t('simulationSectionAdvanced', language)}</h3>
          <details className="stack sim-details">
            <summary>{t('simulationAdvanced', language)}</summary>
            <p>{t('simulationAdvancedPercentilesHelp', language)}</p>
            <p><code>{t('simulationRawMedian', language)}: {Math.round(result.scorePercentiles.p50)} {t('simulationOracleUnitsCorePoints', language)}</code></p>
            <p><code>{t('simulationRawP10', language)}: {Math.round(result.scorePercentiles.p10)} {t('simulationOracleUnitsCorePoints', language)}</code></p>
            <p><code>{t('simulationRawP90', language)}: {Math.round(result.scorePercentiles.p90)} {t('simulationOracleUnitsCorePoints', language)}</code></p>
            <p><code>{t('simulationRawUncertainty', language)}: {uncertainty.toFixed(2)}</code></p>
            <p><code>{t('simulationRawRiskAppetite', language)}: {riskAppetite.toFixed(2)}</code></p>
          </details>

          <div className="cosDivider" aria-hidden="true" />
          <div className="stack">
            <div className="preset-row">
              <button className="cosBtn cosBtn--ghost" onClick={() => { if (result) { saveBaseline({ label: new Date().toLocaleTimeString(), result: { scoreTrajectory: result.scoreTrajectory, horizonMonths: result.horizonMonths, runs: result.runs }, savedAtISO: new Date().toISOString() }); } }}>{t('simulationCompare', language)}</button>
            </div>
          </div>
        </>
      )}
      {helpSheet && (
        <BottomSheetHelp
          language={language}
          title={helpSheet === 'chart' ? t('simulationHowToReadTitle', language) : t('simulationScenarioMeaningTitle', language)}
          lines={helpSheet === 'chart'
            ? [t('simulationHowToReadBand', language), t('simulationHowToReadLines', language), t('simulationHowToReadThreshold', language)]
            : [t('simulationScenarioMeaningOne', language), t('simulationScenarioMeaningTwo', language), t('simulationScenarioMeaningThree', language)]}
          onClose={() => setHelpSheet(null)}
        />
      )}
      <h3 className="sim-section-title">{t('simulationSectionQuest', language)}</h3>
      {isQuestOpen && (
        <div className="sim-quest-modal" role="dialog" aria-modal="true" aria-label={t('simulationQuestModalTitle', language)}>
          <div className="sim-quest-panel stack">
            <strong>{t('simulationQuestModalTitle', language)}</strong>
            <ol>
              <li>{t('simulationQuestStepOne', language)}</li>
              <li>{t('simulationQuestStepTwo', language)}</li>
              <li>{t('simulationQuestStepThree', language)}</li>
            </ol>
            <div className="preset-row">
              <button className="cosBtn cosBtn--accent" onClick={createQuestStub}>{t('simulationQuestCreate', language)}</button>
              <button className="cosBtn cosBtn--ghost" onClick={() => setQuestOpen(false)}>{t('simulationQuestCancel', language)}</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
