import { defaultCoreData } from '../core/storage';
import { useChaosCore } from './state';

export function SettingsScreen() {
  const { data, setData } = useChaosCore();

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

      <button
        onClick={() => {
          const shouldReset = window.confirm('Reset all local Chaos Core data?');
          if (shouldReset) setData(defaultCoreData);
        }}
      >
        Reset local data
      </button>
    </section>
  );
}
