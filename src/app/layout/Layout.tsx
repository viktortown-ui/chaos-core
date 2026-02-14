import { NavLink, Outlet } from 'react-router-dom';
import { containerRegistry } from '../../features/registry';
import { useChaosCore } from '../providers/ChaosCoreProvider';

export function Layout() {
  const { toastMessage, clearToast } = useChaosCore();

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Chaos Core</h1>
      </header>
      <main>
        {toastMessage && (
          <div className="toast" role="status" aria-live="polite">
            <span>{toastMessage}</span>
            <button onClick={clearToast}>Dismiss</button>
          </div>
        )}
        <Outlet />
      </main>
      <nav className="bottombar" aria-label="Main navigation">
        {containerRegistry
          .filter((item) => item.showInNav !== false)
          .map((item) => (
            <NavLink key={item.id} to={item.route} end={item.route === '/'}>
              {item.title}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
