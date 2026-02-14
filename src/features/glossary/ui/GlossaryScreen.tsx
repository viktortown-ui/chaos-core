import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { t } from '../../../shared/i18n';
import { glossaryEntries } from '../model/glossary';

export function GlossaryScreen() {
  const { data } = useChaosCore();
  const language = data.settings.language;

  return (
    <section className="stack">
      <h2>{t('glossaryTitle', language)}</h2>
      <div className="stack">
        {glossaryEntries.map((entry) => (
          <article key={entry.termKey} className="card stack">
            <h3>{t(entry.termKey, language)}</h3>
            <p>{t(entry.definitionKey, language)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
