import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const reportFailure = () => window.dispatchEvent(new Event('rr:sw-error'));
  try {
    const container = navigator.serviceWorker;
    const scope = new URL(import.meta.env.BASE_URL, window.location.href).href;
    const scriptURL = new URL('sw.js', scope).href;
    let updateRequested = false;
    let appRegistration: ServiceWorkerRegistration | undefined;

    container.register(scriptURL, { scope })
      .then((registration) => {
        if (registration.scope !== scope) throw new Error('Unexpected service-worker scope');
        appRegistration = registration;
        const announceUpdate = () => {
          if (registration.waiting?.scriptURL === scriptURL) {
            window.dispatchEvent(new CustomEvent('rr:sw-update', { detail: registration }));
          }
        };
        const watchInstallingWorker = () => {
          const worker = registration.installing;
          if (!worker || worker.scriptURL !== scriptURL) return;
          let installationCompleted = ['installed', 'activating', 'activated'].includes(worker.state);
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') { installationCompleted = true; announceUpdate(); }
            if (worker.state === 'redundant' && !installationCompleted) reportFailure();
          });
        };
        announceUpdate();
        watchInstallingWorker();
        registration.addEventListener('updatefound', watchInstallingWorker);
        window.dispatchEvent(new Event('rr:sw-state'));
        window.addEventListener('rr:apply-update', () => {
          const waiting = registration.waiting;
          if (registration.scope === scope && waiting?.scriptURL === scriptURL) {
            updateRequested = true;
            waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      })
      .catch(reportFailure);
    container.addEventListener('controllerchange', () => {
      if (updateRequested && appRegistration?.scope === scope && container.controller?.scriptURL === scriptURL) {
        window.location.reload();
      }
    });
  } catch {
    reportFailure();
  }
}
