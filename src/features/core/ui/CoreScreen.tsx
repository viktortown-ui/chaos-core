import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyDailyCheckIn, canCheckInToday } from '../../../core/storage';
import { StatKey } from '../../../core/types';
import { xpToLevel } from '../../../core/formulas';
import { StatCard } from '../../../ui/StatCard';
import { useChaosCore } from '../../../app/providers/ChaosCoreProvider';
import { useReducedMotion } from '../../../fx/useReducedMotion';
import { ModalDialog } from '../../../ui/ModalDialog';

const statOptions: { key: StatKey; label: string }[] = [
  { key: 'strength', label: 'Strength' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'wisdom', label: 'Wisdom' },
  { key: 'dexterity', label: 'Dexterity' }
];

export function CoreScreen() {
  const { data, setData } = useChaosCore();
  const [isModalOpen, setModalOpen] = useState(false);
  const canCheckIn = canCheckInToday(data.lastCheckInISO);
  const level = useMemo(() => xpToLevel(data.xp), [data.xp]);
  const reducedMotion = useReducedMotion(data.settings.reduceMotionOverride);

  const runCheckIn = (stat: StatKey) => {
    setData((current) => applyDailyCheckIn(current, stat));
    setModalOpen(false);
  };

  return (
    <section className="stack">
      <div className="row-actions">
        <h2>Core</h2>
        <Link to="/glossary" aria-label="Open glossary" className="help-link">
          ?
        </Link>
      </div>
      <div className="core-sphere-wrap">
        <div className={`core-sphere ${reducedMotion ? 'still' : ''}`} />
        <p>Level {level}</p>
        <p>XP: {data.xp}</p>
      </div>

      <div className="grid-2">
        {statOptions.map((option) => (
          <StatCard key={option.key} label={option.label} value={data.stats[option.key]} />
        ))}
      </div>

      <button disabled={!canCheckIn} onClick={() => setModalOpen(true)}>
        {canCheckIn ? 'Daily Check-in' : 'Already checked in today'}
      </button>

      {isModalOpen && (
        <ModalDialog title="Choose a stat to boost" onClose={() => setModalOpen(false)}>
          <h2>Choose a stat to boost</h2>
          <div className="stack">
            {statOptions.map((option) => (
              <button key={option.key} onClick={() => runCheckIn(option.key)}>
                +1 {option.label}
              </button>
            ))}
          </div>
          <button onClick={() => setModalOpen(false)}>Cancel</button>
        </ModalDialog>
      )}
    </section>
  );
}
