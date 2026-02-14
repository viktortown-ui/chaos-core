import { Link, useNavigate } from 'react-router-dom';
import { buildDemoData, defaultCoreData } from '../../../core/storage';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';

export function SettingsScreen() {
  const { data, setData } = useChaosCore();
  const navigate = useNavigate();

  return (
    <section className="stack">
      <h2>Settings</h2>
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
        Reduce motion override
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
        Sound FX (placeholder)
      </label>

      <button onClick={() => setData(buildDemoData(new Date()))}>Load demo data</button>
      <button
        onClick={() => {
          const shouldReset = window.confirm('Clear demo data and all local Chaos Core data?');
          if (shouldReset) setData(defaultCoreData);
        }}
      >
        Clear demo data (reset local data)
      </button>

      <button
        onClick={() => {
          const shouldReset = window.confirm('Clear history and progression before re-running onboarding?');
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
        Re-run onboarding
      </button>

      <Link to="/glossary">Open glossary / help</Link>
    </section>
  );
}
