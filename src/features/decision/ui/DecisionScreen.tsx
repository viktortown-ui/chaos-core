import { useEffect, useMemo, useRef, useState } from 'react';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { t } from '../../../shared/i18n';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import {
  DecisionBranchPayload,
  DecisionBranchResultPayload,
  DecisionWorkerResponse
} from '../worker/protocol';

type BranchKey = 'A' | 'B' | 'C';

interface BranchTemplate extends Omit<DecisionBranchPayload, 'reasons' | 'nextActions'> {
  branchKey: BranchKey;
  strategyLabelKey: 'decisionAttack' | 'decisionBalance' | 'decisionDefense';
  reasonKeys: [
    'decisionReasonAttackUpside' | 'decisionReasonBalanceBuffer' | 'decisionReasonDefenseDownside',
    'decisionReasonAttackSensitivity' | 'decisionReasonBalanceCompromise' | 'decisionReasonDefenseProtection'
  ];
  actionKeys: [
    'decisionActionAttackLiquidity' | 'decisionActionBalanceMilestones' | 'decisionActionDefenseReserve',
    'decisionActionAttackStopLoss' | 'decisionActionBalanceRiskCap' | 'decisionActionDefensePace',
    'decisionActionAttackSignals' | 'decisionActionBalanceTeamLoad' | 'decisionActionDefenseResilience'
  ];
}

const branchTemplates: BranchTemplate[] = [
  {
    id: 'A',
    branchKey: 'A',
    label: 'A',
    strategy: 'attack',
    strategyLabelKey: 'decisionAttack',
    riskAppetite: 0.82,
    uncertainty: 0.62,
    blackSwanEnabled: false,
    reasonKeys: ['decisionReasonAttackUpside', 'decisionReasonAttackSensitivity'],
    actionKeys: ['decisionActionAttackLiquidity', 'decisionActionAttackStopLoss', 'decisionActionAttackSignals']
  },
  {
    id: 'B',
    branchKey: 'B',
    label: 'B',
    strategy: 'balance',
    strategyLabelKey: 'decisionBalance',
    riskAppetite: 0.55,
    uncertainty: 0.45,
    blackSwanEnabled: true,
    reasonKeys: ['decisionReasonBalanceBuffer', 'decisionReasonBalanceCompromise'],
    actionKeys: ['decisionActionBalanceMilestones', 'decisionActionBalanceRiskCap', 'decisionActionBalanceTeamLoad']
  },
  {
    id: 'C',
    branchKey: 'C',
    label: 'C',
    strategy: 'defense',
    strategyLabelKey: 'decisionDefense',
    riskAppetite: 0.35,
    uncertainty: 0.3,
    blackSwanEnabled: true,
    reasonKeys: ['decisionReasonDefenseDownside', 'decisionReasonDefenseProtection'],
    actionKeys: ['decisionActionDefenseReserve', 'decisionActionDefensePace', 'decisionActionDefenseResilience']
  }
];

const DEBOUNCE_MS = 260;

function riskFlag(risk: number, language: 'ru' | 'en') {
  if (risk >= 0.55) return t('decisionRiskHigh', language);
  if (risk >= 0.35) return t('decisionRiskMedium', language);
  return t('decisionRiskLow', language);
}

function toOutOfTen(risk: number) {
  return Math.min(10, Math.max(0, Math.round(risk * 10)));
}

export function DecisionScreen() {
  const { data } = useChaosCore();
  const language = data.settings.language;
  const [isRunning, setRunning] = useState(false);
  const reducedMotion = useReducedMotion(data.settings.reduceMotionOverride);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [branches, setBranches] = useState<DecisionBranchResultPayload[]>([]);
  const [branchConfig, setBranchConfig] = useState(branchTemplates);

  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);

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

  const cancelActive = () => {
    const worker = workerRef.current;
    const activeId = activeIdRef.current;
    if (!worker || !activeId) return;
    worker.postMessage({ type: 'cancel', id: activeId });
  };

  const runDecision = (config: BranchTemplate[]) => {
    const worker = workerRef.current;
    if (!worker) return;

    cancelActive();
    const requestId = `decision-${Date.now()}`;
    activeIdRef.current = requestId;
    setRunning(true);

    const branchesPayload: DecisionBranchPayload[] = config.map((branch) => ({
      ...branch,
      reasons: branch.reasonKeys.map((key) => t(key, language)),
      nextActions: branch.actionKeys.map((key) => t(key, language))
    }));

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
        branches: branchesPayload
      }
    });
  };

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runDecision(branchConfig), DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      cancelActive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchConfig, data.stats, data.xp, language]);

  const updateBranch = (branchKey: BranchKey, patch: Partial<BranchTemplate>) => {
    setBranchConfig((current) => current.map((branch) => (branch.branchKey === branchKey ? { ...branch, ...patch } : branch)));
  };

  const sortedBranches = useMemo(() => [...branches].sort((a, b) => Number(b.dominant) - Number(a.dominant)), [branches]);

  return (
    <section className={`stack decision-screen${reducedMotion ? ' reduce-motion' : ''}`}>
      <h2>{t('decisionTitle', language)}</h2>
      <p>{t('decisionSubtitle', language)}</p>
      <p>{t('decisionRecomputeDebounced', language)}: {DEBOUNCE_MS}ms</p>
      <button onClick={() => runDecision(branchConfig)} disabled={isRunning}>{isRunning ? t('decisionRunning', language) : t('decisionRun', language)}</button>

      <div className="decision-grid stack">
        {branchConfig.map((branch) => {
          const branchResult = sortedBranches.find((item) => item.id === branch.id);
          return (
            <article key={branch.id} className="card stack">
              <strong>
                {t('decisionBranch', language)} {branch.label} — {t(branch.strategyLabelKey, language)} {branchResult?.dominant ? `• ${t('decisionDominant', language)}` : ''}
              </strong>

              <label className="stack">
                <span>{t('decisionRiskAppetite', language)}: {branch.riskAppetite.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.95}
                  step={0.01}
                  value={branch.riskAppetite}
                  onChange={(event) => updateBranch(branch.branchKey, { riskAppetite: Number(event.target.value) })}
                />
              </label>

              <label className="stack">
                <span>{t('decisionUncertainty', language)}: {branch.uncertainty.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.95}
                  step={0.01}
                  value={branch.uncertainty}
                  onChange={(event) => updateBranch(branch.branchKey, { uncertainty: Number(event.target.value) })}
                />
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={branch.blackSwanEnabled}
                  onChange={(event) => updateBranch(branch.branchKey, { blackSwanEnabled: event.target.checked })}
                />{' '}
                {t('decisionBlackSwan', language)}
              </label>

              {branchResult && (
                <>
                  <p>{t('decisionOutcomeRange', language)}: {branchResult.percentiles.p10.toFixed(1)} / {branchResult.percentiles.p50.toFixed(1)} / {branchResult.percentiles.p90.toFixed(1)}</p>
                  <p>{t('decisionRiskOutOfTen', language)}: {toOutOfTen(branchResult.collapseRisk)} / 10 • {riskFlag(branchResult.collapseRisk, language)}</p>
                  <div>
                    <strong>{t('decisionWhy', language)}</strong>
                    <ul>
                      {branchResult.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong>{t('decisionNextActions', language)}</strong>
                    <ol>
                      {branchResult.nextActions.slice(0, 3).map((action) => <li key={action}>{action}</li>)}
                    </ol>
                  </div>
                </>
              )}
            </article>
          );
        })}
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
