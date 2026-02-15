import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { SimulationResult, StrategyMode } from '../../../core/sim/types';
import { t } from '../../../shared/i18n';
import { SimConfigPayload, SimWorkerResponse } from '../worker/protocol';

type PresetKey = 'blitz' | 'steady' | 'shield';

interface Preset {
  horizonMonths: number;
  uncertainty: number;
  riskAppetite: number;
  strategy: StrategyMode;
  blackSwanEnabled: boolean;
}

const presets: Record<PresetKey, Preset> = {
  blitz: { horizonMonths: 12, uncertainty: 0.7, riskAppetite: 0.85, strategy: 'attack', blackSwanEnabled: false },
  steady: { horizonMonths: 18, uncertainty: 0.45, riskAppetite: 0.5, strategy: 'balance', blackSwanEnabled: true },
  shield: { horizonMonths: 24, uncertainty: 0.35, riskAppetite: 0.3, strategy: 'defense', blackSwanEnabled: true }
};

const leverLabelKey = {
  riskAppetite: 'leverRiskAppetite',
  uncertainty: 'leverUncertainty',
  strategy: 'leverStrategy',
  horizon: 'leverHorizon',
  blackSwanShield: 'leverBlackSwanShield'
} as const;

function outOfTen(value: number): number {
  return Math.round(value * 10);
}

export function SimulationScreen() {
  const { data } = useChaosCore();
  const language = data.settings.language;

  const [horizonMonths, setHorizonMonths] = useState(12);
  const [uncertainty, setUncertainty] = useState(0.5);
  const [riskAppetite, setRiskAppetite] = useState(0.5);
  const [strategy, setStrategy] = useState<StrategyMode>('balance');
  const [blackSwanEnabled, setBlackSwanEnabled] = useState(true);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [isRunning, setRunning] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const configFingerprint = `${horizonMonths}|${uncertainty}|${riskAppetite}|${strategy}|${blackSwanEnabled}`;

  useEffect(() => {
    const worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<SimWorkerResponse>) => {
      const message = event.data;
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
    if (!isRunning || !activeIdRef.current || !workerRef.current) return;
    workerRef.current.postMessage({ type: 'cancel', id: activeIdRef.current });
  }, [configFingerprint, isRunning]);

  const startSimulation = () => {
    const worker = workerRef.current;
    if (!worker) return;
    const requestId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeIdRef.current = requestId;
    setProgress(0);
    setRunning(true);

    const payload: SimConfigPayload = {
      runs: 10_000,
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
      blackSwanEnabled
    };

    worker.postMessage({ type: 'start', id: requestId, config: payload });
  };

  const applyPreset = (presetKey: PresetKey) => {
    const preset = presets[presetKey];
    setHorizonMonths(preset.horizonMonths);
    setUncertainty(preset.uncertainty);
    setRiskAppetite(preset.riskAppetite);
    setStrategy(preset.strategy);
    setBlackSwanEnabled(preset.blackSwanEnabled);
  };

  const histogram = useMemo(() => {
    if (!result) return null;
    const max = Math.max(...result.endingScore.bins, 1);
    return result.endingScore.bins.map((bin) => (bin / max) * 100);
  }, [result]);

  return (
    <section className="stack">
      <h2>{t('simulationTitle', language)}</h2>
      <div className="card stack">
        <label>{t('simulationHorizon', language)}: {horizonMonths}
          <input type="range" min={6} max={24} value={horizonMonths} onChange={(e) => setHorizonMonths(Number(e.target.value))} />
        </label>
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
        <div className="row-actions">
          <span>{t('simulationPreset', language)}</span>
          <div className="preset-row">
            <button onClick={() => applyPreset('blitz')}>{t('presetBlitz', language)}</button>
            <button onClick={() => applyPreset('steady')}>{t('presetSteady', language)}</button>
            <button onClick={() => applyPreset('shield')}>{t('presetShield', language)}</button>
          </div>
        </div>
        <button onClick={startSimulation}>{isRunning ? t('simulationRunning', language) : t('simulationRun', language)}</button>
        {isRunning && <p>{t('simulationProgress', language)}: {Math.round(progress * 100)}%</p>}
      </div>

      {result && (
        <>
          <div className="card stack">
            <strong>{t('simulationHistogramTitle', language)}</strong>
            <div className="sim-histogram" role="img" aria-label={t('simulationHistogramTitle', language)}>
              {histogram?.map((height, index) => (
                <div key={index} className="sim-bar" style={{ height: `${height}%` }} />
              ))}
            </div>
            <p>{t('simulationChanceOutOfTen', language)}: <strong>{outOfTen(result.successRatio)}</strong></p>
          </div>

          <div className="card stack">
            <strong>{t('simulationTopLevers', language)}</strong>
            <ol>
              {result.topLevers.map((lever) => (
                <li key={lever}>{t(leverLabelKey[lever], language)}</li>
              ))}
            </ol>
            <strong>{t('simulationRiskEvents', language)}</strong>
            <p>{t('simulationStressBreaks', language)}: {result.riskEvents.stressBreaks}</p>
            <p>{t('simulationDrawdowns', language)}: {result.riskEvents.drawdownsOver20}</p>
            <p>{t('simulationBlackSwansCount', language)}: {result.riskEvents.blackSwans}</p>
          </div>
        </>
      )}
    </section>
  );
}
