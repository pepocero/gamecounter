import { registerSW } from 'virtual:pwa-register';
import { showPwaUpdateBanner, showToast } from './dialogs.js';

/** Referencia al callback que aplica la nueva versión (skipWaiting). */
let applyUpdateFn = null;

function promptApplyUpdate() {
  showPwaUpdateBanner(async () => {
    try {
      await applyUpdateFn?.();
    } catch {
      window.location.reload();
    }
  });
}

/**
 * Registra el service worker, avisa cuando hay actualización y comprueba
 * con frecuencia (en móvil el “pull to refresh” no siempre actualiza el SW).
 */
export function initPwaUpdates() {
  applyUpdateFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      promptApplyUpdate();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const ping = () => {
        registration.update().catch(() => {});
      };
      ping();
      setTimeout(ping, 1500);
      setTimeout(ping, 5000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') ping();
      });
      window.addEventListener('focus', ping);
      window.addEventListener('online', ping);
      window.addEventListener('pageshow', () => ping());
      setInterval(ping, 15 * 60 * 1000);
      queueMicrotask(() => showBannerIfWaiting(registration));
    }
  });
}

/** Si ya hay un SW en espera, muestra el aviso (por si el evento se perdió). */
function showBannerIfWaiting(reg) {
  if (reg?.waiting && typeof applyUpdateFn === 'function') {
    promptApplyUpdate();
  }
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
    showBannerIfWaiting(reg);
    showToast('Comprobación hecha. Si hay versión nueva, aparecerá el aviso inferior para actualizar.', {
      variant: 'success'
    });
  } catch (e) {
    showToast(e?.message || 'No se pudo comprobar actualizaciones.', { variant: 'error' });
  }
}

/**
 * Desregistra el service worker, borra cachés de la app y recarga.
 * No borra datos (localStorage). Útil cuando la PWA instalada sigue en una versión vieja.
 */
export async function forceReloadLatestVersion() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }
  window.location.reload();
}
