import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../layout/Layout';
import { containerRegistry } from '../../features/registry';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {containerRegistry.map((manifest) => {
          const Component = manifest.component;
          const relativeRoute = manifest.route === '/' ? undefined : manifest.route.slice(1);

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
