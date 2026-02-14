import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { t } from '../../../shared/i18n';

export function QuestsScreen() {
  const { data } = useChaosCore();
  const language = data.settings.language;

  return (
    <section className="stack">
      <h2>{t('questsTitle', language)}</h2>
      <p>{t('questsPlaceholder', language)}</p>
    </section>
  );
}
