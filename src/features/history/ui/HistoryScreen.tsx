import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { xpToLevel } from '../../../core/formulas';
import { SimulationResult, StrategyMode } from '../../../core/sim/types';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { t } from '../../../shared/i18n';
import { UPlotChart, UPlotSeries } from '../../charts/UPlotChart';
import { SimConfigPayload, SimWorkerResponse } from '../../sim/worker/protocol';

interface HistoryPoint {
  ts: number;
  xp: number;
  level: number;
  strength: number;
  intelligence: number;
  wisdom: number;
  score: number;
}

function buildHistoryPoints(data: ReturnType<typeof useChaosCore>['data']): HistoryPoint[] {
  const sorted = [...data.history].sort((a, b) => new Date(a.atISO).getTime() - new Date(b.atISO).getTime());

  let xp = 0;
  const stats = { strength: 0, intelligence: 0, wisdom: 0, dexterity: 0 };
  const points: HistoryPoint[] = [];

  sorted.forEach((entry) => {
    if (entry.kind === 'check-in') {
      xp += 10;
      const statMatch = entry.note.match(/\+1\s+(strength|intelligence|wisdom|dexterity)/i);
      const statKey = statMatch?.[1]?.toLowerCase() as keyof typeof stats | undefined;
      if (statKey) stats[statKey] += 1;
    }

    points.push({
      ts: new Date(entry.atISO).getTime() / 1000,
      xp,
      level: xpToLevel(xp),
      strength: stats.strength,
      intelligence: stats.intelligence,
      wisdom: stats.wisdom,
      score: xp * 0.45 + (stats.strength + stats.intelligence + stats.wisdom + stats.dexterity) * 5
    });
  });

  const nowTs = Date.now() / 1000;
  points.push({
    ts: nowTs,
    xp: data.xp,
    level: xpToLevel(data.xp),
    strength: data.stats.strength,
    intelligence: data.stats.intelligence,
    wisdom: data.stats.wisdom,
    score: data.xp * 0.45 + (data.stats.strength + data.stats.intelligence + data.stats.wisdom + data.stats.dexterity) * 5
  });

  return points.length > 1 ? points : [{ ...points[0], ts: nowTs - 86400 }, points[0]];
}

export function HistoryScreen() {
  const { data } = useChaosCore();
  const language = data.settings.language;
  const reducedMotion = useReducedMotion(data.settings.reduceMotionOverride);

  const [horizonMonths, setHorizonMonths] = useState(12);
  const [uncertainty, setUncertainty] = useState(0.5);
  const [riskAppetite, setRiskAppetite] = useState(0.5);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const historyPoints = useMemo(() => buildHistoryPoints(data), [data]);

  useEffect(() => {
    const worker = new Worker(new URL('../../sim/worker/sim.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<SimWorkerResponse>) => {
      const message = event.data;
      if (message.id !== activeIdRef.current) return;
      if (message.type === 'progress') setResult(message.partialResult);
      if (message.type === 'done') setResult(message.result);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    const timeout = window.setTimeout(() => {
      const requestId = `history-forecast-${Date.now()}`;
      activeIdRef.current = requestId;

      const payload: SimConfigPayload = {
        runs: 4000,
        horizonMonths,
        dtDays: 5,
        seed: 4242,
        baseState: {
          capital: Math.max(40, data.xp * 0.6),
          resilience: (data.stats.wisdom + data.stats.dexterity) * 2,
          momentum: (data.stats.strength + data.stats.intelligence) * 1.4,
          stress: Math.max(5, 30 - data.stats.wisdom)
        },
        strategy: 'balance' as StrategyMode,
        uncertainty,
        riskAppetite,
        blackSwanEnabled: true,
        successThreshold: Math.max(80, data.xp * 0.45 + (data.stats.strength + data.stats.intelligence + data.stats.wisdom + data.stats.dexterity) * 5)
      };

      worker.postMessage({ type: 'start', id: requestId, config: payload });
    }, 240);

    return () => window.clearTimeout(timeout);
  }, [horizonMonths, uncertainty, riskAppetite, data.xp, data.stats.dexterity, data.stats.intelligence, data.stats.strength, data.stats.wisdom]);

  const metricsChartData = useMemo(() => {
    return [
      historyPoints.map((point) => point.ts),
      historyPoints.map((point) => point.xp),
      historyPoints.map((point) => point.level),
      historyPoints.map((point) => point.strength),
      historyPoints.map((point) => point.wisdom)
    ];
  }, [historyPoints]);

  const metricsSeries: UPlotSeries[] = [
    { label: t('xp', language), color: '#82b5ff' },
    { label: t('level', language), color: '#6df7cb' },
    { label: t('statStrength', language), color: '#fcb36a' },
    { label: t('statWisdom', language), color: '#c1a3ff' }
  ];

  const forecastData = useMemo(() => {
    const ts = historyPoints.map((point) => point.ts);
    const scoreHistory = historyPoints.map((point) => point.score);

    const trajectory = result?.scoreTrajectory ?? [];
    const baseTs = ts[ts.length - 1];
    const horizonTs = trajectory.map((entry) => baseTs + (entry.dayOffset * 86400));

    return [
      [...ts, ...horizonTs],
      [...scoreHistory, ...horizonTs.map(() => null)],
      [...ts.map(() => null), ...trajectory.map((entry) => entry.p10)],
      [...ts.map(() => null), ...trajectory.map((entry) => entry.p50)],
      [...ts.map(() => null), ...trajectory.map((entry) => entry.p90)]
    ];
  }, [historyPoints, result]);

  const forecastSeries: UPlotSeries[] = [
    { label: t('historyActualScore', language), color: '#8ac0ff' },
    { label: t('historyForecastP10', language), color: '#6a84b7', dash: [8, 6] },
    { label: t('historyForecastP50', language), color: '#56d9a4', width: 3, fill: 'rgba(86, 217, 164, 0.16)' },
    { label: t('historyForecastP90', language), color: '#f7a56a', dash: [8, 6] }
  ];

  const distributionData = useMemo(() => {
    if (!result) return null;
    const centers = result.endingScore.binEdges.slice(0, -1).map((edge, index) => (edge + result.endingScore.binEdges[index + 1]) / 2);
    return [centers, result.endingScore.bins];
  }, [result]);

  return (
    <section className="stack">
      <h2>{t('historyTitle', language)}</h2>
      <div className="card stack">
        <strong>{t('historyMetricsTitle', language)}</strong>
        <UPlotChart
          kind="time-series"
          data={metricsChartData}
          series={metricsSeries}
          ariaLabel={t('historyMetricsTitle', language)}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className="card stack history-forecast-panel" style={{ transition: reducedMotion ? 'none' : 'opacity 180ms ease-out' }}>
        <strong>{t('historyForecastTitle', language)}</strong>
        <label>
          {t('simulationHorizon', language)}: {horizonMonths}
          <input type="range" min={6} max={24} value={horizonMonths} onChange={(event) => setHorizonMonths(Number(event.target.value))} />
        </label>
        <label>
          {t('simulationUncertainty', language)}: {uncertainty.toFixed(2)}
          <input type="range" min={0.1} max={1} step={0.01} value={uncertainty} onChange={(event) => setUncertainty(Number(event.target.value))} />
        </label>
        <label>
          {t('simulationRiskAppetite', language)}: {riskAppetite.toFixed(2)}
          <input type="range" min={0.1} max={1} step={0.01} value={riskAppetite} onChange={(event) => setRiskAppetite(Number(event.target.value))} />
        </label>
        <UPlotChart
          kind="time-series"
          data={forecastData}
          series={forecastSeries}
          ariaLabel={t('historyForecastTitle', language)}
          reducedMotion={reducedMotion}
        />
      </div>

      {distributionData && (
        <div className="card stack">
          <strong>{t('historyDistributionTitle', language)}</strong>
          <UPlotChart
            kind="distribution"
            data={distributionData}
            series={[{ label: t('historyDistributionTitle', language), color: '#7ab1ff', fill: 'rgba(122, 177, 255, 0.25)' }]}
            ariaLabel={t('historyDistributionTitle', language)}
            reducedMotion={reducedMotion}
          />
        </div>
      )}
    </section>
  );
}
