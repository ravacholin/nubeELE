import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaControls({ isOnline }: { isOnline: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [standalone, setStandalone] = useState(() => window.matchMedia('(display-mode: standalone)').matches
    || !!(navigator as Navigator & { standalone?: boolean }).standalone);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError(error) { console.warn('No se pudo preparar el modo sin conexión.', error); },
    onRegisteredSW(_url, registration) {
      // Check when the app is reopened; updates wait for the user's action.
      if (registration && navigator.onLine) void registration.update().catch(() => {});
    },
  });

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => { setStandalone(true); setInstallPrompt(null); setInstructionsOpen(false); };
    const mode = window.matchMedia('(display-mode: standalone)');
    const modeChanged = () => setStandalone(mode.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    mode.addEventListener('change', modeChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      mode.removeEventListener('change', modeChanged);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) { setInstructionsOpen(true); return; }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch { setInstructionsOpen(true); }
  };

  return <>
    {!standalone && (installPrompt || isIOS) ? (
      <button onClick={install} className="nav-link pwa-install" title="Instalar NubeELE" aria-label="Instalar NubeELE">
        <Download className="nav-icon" aria-hidden="true" />
      </button>
    ) : null}
    {createPortal(<div className="pwa-notices" aria-live="polite">
      {!isOnline ? <div className="pwa-notice" role="status">Sin conexión · Puedes consultar tu nube y tus palabras guardadas.</div> : null}
      {instructionsOpen ? <div className="pwa-notice">
        <span>{isIOS ? 'En Safari, toca Compartir y luego «Añadir a pantalla de inicio».' : 'Abre el menú del navegador y elige «Instalar NubeELE» o «Añadir a pantalla de inicio».'}</span>
        <button className="notice-close" aria-label="Cerrar instrucciones de instalación" onClick={() => setInstructionsOpen(false)}><X aria-hidden="true" /></button>
      </div> : null}
      {needRefresh ? <div className="pwa-notice">
        <span>Hay una nueva versión de NubeELE.</span>
        <button className="bar-button" disabled={!isOnline} onClick={() => { void updateServiceWorker(true); }}>Actualizar</button>
        <button className="notice-close" aria-label="Actualizar más tarde" onClick={() => setNeedRefresh(false)}><X aria-hidden="true" /></button>
      </div> : null}
    </div>, document.body)}
  </>;
}
