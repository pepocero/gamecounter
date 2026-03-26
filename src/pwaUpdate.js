import { registerSW } from 'virtual:pwa-register';
import { showPwaUpdateBanner, showToast } from './dialogs.js';

/** Referencia al callback que aplica la nueva versión (skipWaiting). */
let applyUpdateFn = null;

/**
 * Registra el service worker, avisa cuando hay actualización y comprueba
 * al volver a la app / al enfocar la ventana.
 */
export function initPwaUpdates() {
  applyUpdateFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      showPwaUpdateBanner(async () => {
        try {
          await applyUpdateFn?.();
        } catch {
          window.location.reload();
        }
      });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const ping = () => {
        registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') ping();
      });
      window.addEventListener('focus', ping);
      setInterval(ping, 4 * 60 * 60 * 1000);
    }
  });
}

/** Desde Configuración: pide al navegador comprobar si hay un SW nuevo en el servidor. */
export async function checkForUpdatesManually() {
  if (!('serviceWorker' in navigator)) {
    showToast('Tu navegador no soporta actualización en segundo plano.', { variant: 'error' });
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      showToast(
        'No hay app instalada como PWA. Abre GameScore desde el icono de la pantalla o usa el navegador.',
        { variant: 'error' }
      );
      return;
    }
    await reg.update();
    showToast('Comprobación enviada. Si hay novedades, aparecerá el aviso para actualizar.', {
      variant: 'success'
    });
  } catch (e) {
    showToast(e?.message || 'No se pudo comprobar actualizaciones.', { variant: 'error' });
  }
}
