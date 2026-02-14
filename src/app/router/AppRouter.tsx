import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../layout/Layout';
import { containerRegistry } from '../../features/registry';
import { useChaosCore } from '../providers/ChaosCoreProvider';

export function AppRouter() {
  const { data } = useChaosCore();
  const onboardingComplete = Boolean(data.onboarding.completedAt);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {containerRegistry.map((manifest) => {
          const Component = manifest.component;
          const relativeRoute = manifest.route === '/' ? undefined : manifest.route.slice(1);

          if (!onboardingComplete && manifest.route !== '/onboarding') {
            return manifest.route === '/' ? (
              <Route key={manifest.id} index element={<Navigate to="/onboarding" replace />} />
            ) : (
              <Route key={manifest.id} path={relativeRoute} element={<Navigate to="/onboarding" replace />} />
            );
          }

          return manifest.route === '/' ? (
            <Route key={manifest.id} index element={<Component />} />
          ) : (
            <Route key={manifest.id} path={relativeRoute} element={<Component />} />
          );
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
