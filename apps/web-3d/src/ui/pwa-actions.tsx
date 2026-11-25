'use client';

import { Button } from '@netverse/ui/react';
import { useEffect, useRef, useState } from 'react';
import { vi } from './text/vi.ts';
import styles from './pwa-actions.module.css';

type InstallPrompt = Event & { prompt: () => Promise<unknown> };
type UpdateAction = ServiceWorker | 'reload';

export default function PwaActions() {
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [update, setUpdate] = useState<UpdateAction | null>(null);
  const activating = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    const workers = navigator.serviceWorker;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let controlled = Boolean(workers.controller);
    let cancelled = false;

    function showWaiting() {
      const waiting = registration?.waiting;
      if (waiting && workers.controller) setUpdate(waiting);
    }

    function watchInstallation() {
      installing?.removeEventListener('statechange', showWaiting);
      installing = registration?.installing ?? null;
      installing?.addEventListener('statechange', showWaiting);
      showWaiting();
    }

    function controllerChanged() {
      if (activating.current) window.location.reload();
      else if (controlled) setUpdate('reload');
      controlled = Boolean(workers.controller);
    }

    function checkForUpdate() {
      if (document.visibilityState === 'visible') {
        void registration?.update().catch(() => undefined);
      }
    }

    function offerInstall(event: Event) {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    }

    function installed() {
      setInstall(null);
    }

    workers.addEventListener('controllerchange', controllerChanged);
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('beforeinstallprompt', offerInstall);
    window.addEventListener('appinstalled', installed);
    void workers
      .register('/sw.js', { updateViaCache: 'none' })
      .then((result) => {
        if (cancelled) return;
        registration = result;
        registration.addEventListener('updatefound', watchInstallation);
        watchInstallation();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      installing?.removeEventListener('statechange', showWaiting);
      registration?.removeEventListener('updatefound', watchInstallation);
      workers.removeEventListener('controllerchange', controllerChanged);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.removeEventListener('beforeinstallprompt', offerInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  function applyUpdate() {
    if (!update || activating.current) return;
    if (update === 'reload' || update.state === 'activated') {
      window.location.reload();
      return;
    }
    activating.current = true;
    update.postMessage('NETVERSE_ACTIVATE_UPDATE');
  }

  if (!update && !install) return null;

  return (
    <div className={styles.actions} aria-live="polite">
      {update ? (
        <Button surface="neon" tone="cyan" duo="magenta" onClick={applyUpdate}>
          {vi.pwa.update}
        </Button>
      ) : (
        <Button
          surface="neon"
          tone="cyan"
          duo="magenta"
          onClick={() => {
            setInstall(null);
            void install?.prompt().catch(() => undefined);
          }}
        >
          {vi.pwa.install}
        </Button>
      )}
    </div>
  );
}
