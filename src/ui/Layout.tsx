import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Core' },
  { to: '/quests', label: 'Quests' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' }
];

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
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
