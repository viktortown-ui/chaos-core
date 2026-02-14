import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyDailyCheckIn, canCheckInToday } from '../../../core/storage';
import { StatKey } from '../../../core/types';
import { xpToLevel } from '../../../core/formulas';
import { StatCard } from '../../../ui/StatCard';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { ModalDialog } from '../../../ui/ModalDialog';
import { t } from '../../../shared/i18n';
import { AtomicCore } from './AtomicCore';

const statOptions: { key: StatKey; labelKey: 'statStrength' | 'statIntelligence' | 'statWisdom' | 'statDexterity' }[] = [
  { key: 'strength', labelKey: 'statStrength' },
  { key: 'intelligence', labelKey: 'statIntelligence' },
  { key: 'wisdom', labelKey: 'statWisdom' },
  { key: 'dexterity', labelKey: 'statDexterity' }
];

export function CoreScreen() {
  const { data, setData } = useChaosCore();
  const [isModalOpen, setModalOpen] = useState(false);
  const canCheckIn = canCheckInToday(data.lastCheckInISO);
  const level = useMemo(() => xpToLevel(data.xp), [data.xp]);
  const reducedMotion = useReducedMotion(data.settings.reduceMotionOverride);
  const language = data.settings.language;

  const runCheckIn = (stat: StatKey) => {
    setData((current) => applyDailyCheckIn(current, stat));
    setModalOpen(false);
  };

  return (
    <section className="stack">
      <div className="row-actions">
        <h2>{t('coreTitle', language)}</h2>
        <Link to="/glossary" aria-label={t('openGlossary', language)} className="help-link">
          ?
        </Link>
      </div>
      <div className="core-sphere-wrap">
        <AtomicCore reducedMotion={reducedMotion} language={language} />
        <p>{t('level', language)} {level}</p>
        <p>{t('xp', language)}: {data.xp}</p>
      </div>

      <div className="grid-2">
        {statOptions.map((option) => (
          <StatCard key={option.key} label={t(option.labelKey, language)} value={data.stats[option.key]} />
        ))}
      </div>

      <button disabled={!canCheckIn} onClick={() => setModalOpen(true)}>
        {canCheckIn ? t('dailyCheckIn', language) : t('alreadyCheckedInToday', language)}
      </button>

      {isModalOpen && (
        <ModalDialog title={t('chooseStatToBoost', language)} onClose={() => setModalOpen(false)}>
          <h2>{t('chooseStatToBoost', language)}</h2>
          <div className="stack">
            {statOptions.map((option) => (
              <button key={option.key} onClick={() => runCheckIn(option.key)}>
                +1 {t(option.labelKey, language)}
              </button>
            ))}
          </div>
          <button onClick={() => setModalOpen(false)}>{t('cancel', language)}</button>
        </ModalDialog>
      )}
    </section>
  );
}
