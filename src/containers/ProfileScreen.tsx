import { xpToLevel } from '../core/formulas';
import { useChaosCore } from './state';

export function ProfileScreen() {
  const { data } = useChaosCore();

  return (
    <section className="stack">
      <h2>Profile</h2>
      <p>Level: {xpToLevel(data.xp)}</p>
      <p>Total XP: {data.xp}</p>
      <p>Last check-in: {data.lastCheckInISO ? new Date(data.lastCheckInISO).toLocaleString() : 'Never'}</p>
    </section>
  );
}
