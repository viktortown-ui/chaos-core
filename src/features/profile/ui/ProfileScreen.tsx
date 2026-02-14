import { xpToLevel } from '../../../core/formulas';
import { PathKey, StatKey } from '../../../core/types';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { TranslationKey, t } from '../../../shared/i18n';

const pathLabels: Record<PathKey, TranslationKey> = {
  warrior: 'pathWarrior',
  mage: 'pathMage',
  rogue: 'pathRogue',
  priest: 'pathPriest'
};

const statLabels: Record<StatKey, TranslationKey> = {
  strength: 'statStrength',
  intelligence: 'statIntelligence',
  wisdom: 'statWisdom',
  dexterity: 'statDexterity'
};

export function ProfileScreen() {
  const { data } = useChaosCore();
  const language = data.settings.language;

  return (
    <section className="stack">
      <h2>{t('profileTitle', language)}</h2>
      <p>{t('level', language)}: {xpToLevel(data.xp)}</p>
      <p>{t('totalXp', language)}: {data.xp}</p>
      <p>{t('path', language)}: {data.profile.path ? t(pathLabels[data.profile.path], language) : t('notSet', language)}</p>
      <p>{t('focusStat', language)}: {data.profile.focusStat ? t(statLabels[data.profile.focusStat], language) : t('notSet', language)}</p>
      <p>{t('lastCheckIn', language)}: {data.lastCheckInISO ? new Date(data.lastCheckInISO).toLocaleString() : t('never', language)}</p>
    </section>
  );
}
