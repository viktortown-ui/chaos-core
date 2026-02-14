import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PathKey, StatKey } from '../../../core/types';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { t } from '../../../shared/i18n';

const pathOptions: { value: PathKey; labelKey: 'pathWarrior' | 'pathMage' | 'pathRogue' | 'pathPriest' }[] = [
  { value: 'warrior', labelKey: 'pathWarrior' },
  { value: 'mage', labelKey: 'pathMage' },
  { value: 'rogue', labelKey: 'pathRogue' },
  { value: 'priest', labelKey: 'pathPriest' }
];

const statOptions: { value: StatKey; labelKey: 'statStrength' | 'statIntelligence' | 'statWisdom' | 'statDexterity' }[] = [
  { value: 'strength', labelKey: 'statStrength' },
  { value: 'intelligence', labelKey: 'statIntelligence' },
  { value: 'wisdom', labelKey: 'statWisdom' },
  { value: 'dexterity', labelKey: 'statDexterity' }
];

export function OnboardingScreen() {
  const { data, completeOnboarding } = useChaosCore();
  const [step, setStep] = useState(1);
  const [path, setPath] = useState<PathKey | undefined>(data.profile.path);
  const [focusStat, setFocusStat] = useState<StatKey | undefined>(data.profile.focusStat);
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion(data.settings.reduceMotionOverride);
  const language = data.settings.language;

  const summary = useMemo(
    () => ({
      path: pathOptions.find((option) => option.value === path)?.labelKey,
      focus: statOptions.find((option) => option.value === focusStat)?.labelKey
    }),
    [focusStat, path]
  );

  const finish = () => {
    completeOnboarding(path, focusStat);
    navigate('/');
  };

  return (
    <section className={`stack onboarding ${reducedMotion ? 'reduce-motion' : ''}`}>
      <h2>{t('onboardingWelcome', language)}</h2>

      {step === 1 && (
        <div className="card stack">
          <h3>{t('onboardingChoosePath', language)}</h3>
          {pathOptions.map((option) => (
            <button key={option.value} className={path === option.value ? 'active-choice' : ''} onClick={() => setPath(option.value)}>
              {t(option.labelKey, language)}
            </button>
          ))}
          <div className="row-actions">
            <button onClick={finish}>{t('skip', language)}</button>
            <button onClick={() => setStep(2)} disabled={!path}>
              {t('next', language)}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card stack">
          <h3>{t('onboardingPickFocusStat', language)}</h3>
          {statOptions.map((option) => (
            <button
              key={option.value}
              className={focusStat === option.value ? 'active-choice' : ''}
              onClick={() => setFocusStat(option.value)}
            >
              {t(option.labelKey, language)}
            </button>
          ))}
          <div className="row-actions">
            <button onClick={finish}>{t('skip', language)}</button>
            <button onClick={() => setStep(3)} disabled={!focusStat}>
              {t('next', language)}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card stack">
          <h3>{t('onboardingReady', language)}</h3>
          <p>{t('path', language)}: {summary.path ? t(summary.path, language) : t('notSet', language)}</p>
          <p>{t('focusStat', language)}: {summary.focus ? t(summary.focus, language) : t('notSet', language)}</p>
          <div className="row-actions">
            <button onClick={finish}>{t('skip', language)}</button>
            <button onClick={finish}>{t('start', language)}</button>
          </div>
        </div>
      )}
    </section>
  );
}
