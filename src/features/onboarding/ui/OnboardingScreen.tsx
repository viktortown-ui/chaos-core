import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PathKey, StatKey } from '../../../core/types';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { useReducedMotion } from '../../../fx/useReducedMotion';

const pathOptions: { value: PathKey; label: string }[] = [
  { value: 'warrior', label: 'Warrior' },
  { value: 'mage', label: 'Mage' },
  { value: 'rogue', label: 'Rogue' },
  { value: 'priest', label: 'Priest' }
];

const statOptions: { value: StatKey; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'intelligence', label: 'Intellect' },
  { value: 'wisdom', label: 'Wisdom' },
  { value: 'dexterity', label: 'Dexterity' }
];

export function OnboardingScreen() {
  const { data, completeOnboarding } = useChaosCore();
  const [step, setStep] = useState(1);
  const [path, setPath] = useState<PathKey | undefined>(data.profile.path);
  const [focusStat, setFocusStat] = useState<StatKey | undefined>(data.profile.focusStat);
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion(data.settings.reduceMotionOverride);

  const summary = useMemo(
    () => ({
      path: pathOptions.find((option) => option.value === path)?.label ?? 'Not set',
      focus: statOptions.find((option) => option.value === focusStat)?.label ?? 'Not set'
    }),
    [focusStat, path]
  );

  const finish = () => {
    completeOnboarding(path, focusStat);
    navigate('/');
  };

  return (
    <section className={`stack onboarding ${reducedMotion ? 'reduce-motion' : ''}`}>
      <h2>Welcome to Chaos Core</h2>

      {step === 1 && (
        <div className="card stack">
          <h3>Choose your Path</h3>
          {pathOptions.map((option) => (
            <button key={option.value} className={path === option.value ? 'active-choice' : ''} onClick={() => setPath(option.value)}>
              {option.label}
            </button>
          ))}
          <div className="row-actions">
            <button onClick={finish}>Skip</button>
            <button onClick={() => setStep(2)} disabled={!path}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card stack">
          <h3>Pick 1 focus stat</h3>
          {statOptions.map((option) => (
            <button
              key={option.value}
              className={focusStat === option.value ? 'active-choice' : ''}
              onClick={() => setFocusStat(option.value)}
            >
              {option.label}
            </button>
          ))}
          <div className="row-actions">
            <button onClick={finish}>Skip</button>
            <button onClick={() => setStep(3)} disabled={!focusStat}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card stack">
          <h3>Ready</h3>
          <p>Path: {summary.path}</p>
          <p>Focus stat: {summary.focus}</p>
          <div className="row-actions">
            <button onClick={finish}>Skip</button>
            <button onClick={finish}>Start</button>
          </div>
        </div>
      )}
    </section>
  );
}
