import { Link, useNavigate } from 'react-router-dom';
import { buildDemoData, defaultCoreData } from '../../../core/storage';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { Language } from '../../../core/types';
import { t } from '../../../shared/i18n';

export function SettingsScreen() {
  const { data, setData } = useChaosCore();
  const navigate = useNavigate();
  const language = data.settings.language;

  return (
    <section className="stack">
      <h2>{t('settingsTitle', language)}</h2>
      <label>
        {t('language', language)}
        <select
          value={language}
          onChange={(event) =>
            setData((current) => ({
              ...current,
              settings: {
                ...current.settings,
                language: event.target.value as Language
              }
            }))
          }
        >
          <option value="ru">{t('languageRu', language)}</option>
          <option value="en">{t('languageEn', language)}</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={Boolean(data.settings.reduceMotionOverride)}
          onChange={(event) =>
            setData((current) => ({
              ...current,
              settings: {
                ...current.settings,
                reduceMotionOverride: event.target.checked
              }
            }))
          }
        />
        {t('reduceMotionOverride', language)}
      </label>

      <label>
        <input
          type="checkbox"
          checked={data.settings.soundFxEnabled}
          onChange={(event) =>
            setData((current) => ({
              ...current,
              settings: {
                ...current.settings,
                soundFxEnabled: event.target.checked
              }
            }))
          }
        />
        {t('soundFxPlaceholder', language)}
      </label>

      <button onClick={() => setData(buildDemoData(new Date()))}>{t('loadDemoData', language)}</button>
      <button
        onClick={() => {
          const shouldReset = window.confirm(t('confirmClearDemo', language));
          if (shouldReset) setData(defaultCoreData);
        }}
      >
        {t('clearDemoData', language)}
      </button>

      <button
        onClick={() => {
          const shouldReset = window.confirm(t('confirmRerunOnboarding', language));
          if (shouldReset) {
            setData(defaultCoreData);
          } else {
            setData((current) => ({
              ...current,
              onboarding: {
                ...current.onboarding,
                completedAt: undefined
              }
            }));
          }
          navigate('/onboarding');
        }}
      >
        {t('rerunOnboarding', language)}
      </button>

      <Link to="/glossary">{t('openGlossaryHelp', language)}</Link>
    </section>
  );
}
