import { NavLink, Outlet } from 'react-router-dom';
import { containerRegistry } from '../../features/registry';
import { useChaosCore } from '../providers/ChaosCoreProvider';
import { t } from '../../shared/i18n';

export function Layout() {
  const { toastMessage, clearToast, data } = useChaosCore();
  const language = data.settings.language;

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>{t('appTitle', language)}</h1>
      </header>
      <main>
        {toastMessage && (
          <div className="toast" role="status" aria-live="polite">
            <span>{toastMessage}</span>
            <button onClick={clearToast}>{t('dismiss', language)}</button>
          </div>
        )}
        <Outlet />
      </main>
      <nav className="bottombar" aria-label={t('mainNavigation', language)}>
        {containerRegistry
          .filter((item) => item.showInNav !== false)
          .map((item) => (
            <NavLink key={item.id} to={item.route} end={item.route === '/'}>
              {t(item.titleKey, language)}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
