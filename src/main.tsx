import { registerSW } from 'virtual:pwa-register';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { ChaosCoreProvider } from './containers/state';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/chaos-core/">
      <ChaosCoreProvider>
        <App />
      </ChaosCoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);

registerSW({ immediate: true });
