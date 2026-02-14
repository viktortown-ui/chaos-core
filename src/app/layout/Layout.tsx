import { NavLink, Outlet } from 'react-router-dom';
import { containerRegistry } from '../../features/registry';

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Chaos Core</h1>
      </header>
      <main>
        <Outlet />
      </main>
      <nav className="bottombar" aria-label="Main navigation">
        {containerRegistry.map((item) => (
          <NavLink key={item.id} to={item.route} end={item.route === '/'}>
            {item.title}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
