import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { t } from '../../../shared/i18n';
import { DecisionBranchPayload, DecisionBranchResultPayload, DecisionWorkerResponse } from '../worker/protocol';

const branchTemplates: DecisionBranchPayload[] = [
  {
    id: 'A',
    label: 'A',
    strategy: 'attack',
    riskAppetite: 0.82,
    uncertainty: 0.62,
    blackSwanEnabled: false,
    reasons: ['Растущий апсайд при ускорении', 'Высокая чувствительность к неопределённости'],
    nextActions: ['Проверить ликвидность на 3 месяца', 'Поставить порог стоп-лосса', 'Собрать ранние сигналы']
  },
  {
    id: 'B',
    label: 'B',
    strategy: 'balance',
    riskAppetite: 0.55,
    uncertainty: 0.45,
    blackSwanEnabled: true,
    reasons: ['Умеренный рост с буфером устойчивости', 'Компромисс между темпом и риском'],
    nextActions: ['Закрепить контрольные точки по месяцу', 'Ограничить риск в новых шагах', 'Проверить командную нагрузку']
  },
  {
    id: 'C',
    label: 'C',
    strategy: 'defense',
    riskAppetite: 0.35,
    uncertainty: 0.3,
    blackSwanEnabled: true,
    reasons: ['Ниже downside при стрессах', 'Сильнее защитные факторы'],
    nextActions: ['Сохранить резерв капитала', 'Пересмотреть темп роста', 'Укрепить отказоустойчивость']
  }
];

function riskFlag(risk: number, language: 'ru' | 'en') {
  if (risk >= 0.55) return t('decisionRiskHigh', language);
  if (risk >= 0.35) return t('decisionRiskMedium', language);
  return t('decisionRiskLow', language);
}

export function DecisionScreen() {
  const { data } = useChaosCore();
  const language = data.settings.language;
  const [isRunning, setRunning] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [branches, setBranches] = useState<DecisionBranchResultPayload[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../worker/decision.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<DecisionWorkerResponse>) => {
      const message = event.data;
      if (message.id !== activeIdRef.current) return;
      if (message.type === 'done') {
        setBranches(message.branches);
        setRunning(false);
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

  const runDecision = () => {
    const worker = workerRef.current;
    if (!worker) return;

    const requestId = `decision-${Date.now()}`;
    activeIdRef.current = requestId;
    setRunning(true);

    worker.postMessage({
      type: 'start',
      id: requestId,
      config: {
        runs: 4000,
        horizonMonths: 18,
        dtDays: 5,
        seed: 1212,
        baseState: {
          capital: Math.max(45, data.xp * 0.5),
          resilience: (data.stats.wisdom + data.stats.dexterity) * 2,
          momentum: (data.stats.strength + data.stats.intelligence) * 1.2,
          stress: Math.max(6, 32 - data.stats.wisdom)
        },
        branches: branchTemplates
      }
    });
  };

  const sortedBranches = useMemo(() => {
    return [...branches].sort((a, b) => Number(b.dominant) - Number(a.dominant));
  }, [branches]);

  return (
    <section className="stack">
      <h2>{t('decisionTitle', language)}</h2>
      <p>{t('decisionSubtitle', language)}</p>
      <button onClick={runDecision} disabled={isRunning}>{isRunning ? t('decisionRunning', language) : t('decisionRun', language)}</button>

      <div className="grid-2 decision-grid">
        {sortedBranches.map((branch) => (
          <article key={branch.id} className="card stack">
            <strong>{t('decisionBranch', language)} {branch.label} {branch.dominant ? `• ${t('decisionDominant', language)}` : ''}</strong>
            <p>{t('decisionOutcomeRange', language)}: {branch.percentiles.p10.toFixed(1)} / {branch.percentiles.p50.toFixed(1)} / {branch.percentiles.p90.toFixed(1)}</p>
            <p>{t('decisionRiskFlag', language)}: {riskFlag(branch.collapseRisk, language)}</p>
            <div>
              <strong>{t('decisionWhy', language)}</strong>
              <ul>
                {branch.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
            <div>
              <strong>{t('decisionNextActions', language)}</strong>
              <ol>
                {branch.nextActions.slice(0, 3).map((action) => <li key={action}>{action}</li>)}
              </ol>
            </div>
          </article>
        ))}
      </div>

      {branches.length > 0 && (
        <div className="card stack">
          <button onClick={() => setAdvancedOpen((value) => !value)}>{t('decisionAdvanced', language)}</button>
          {advancedOpen && (
            <div className="stack">
              {branches.map((branch) => (
                <pre key={branch.id} className="decision-raw">{JSON.stringify(branch, null, 2)}</pre>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
