import { registerSW } from 'virtual:pwa-register';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/router/AppRouter';
import { ChaosCoreProvider } from './app/providers/ChaosCoreProvider';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ChaosCoreProvider>
        <AppRouter />
      </ChaosCoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);

registerSW({ immediate: true });
