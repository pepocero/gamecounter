import { showConfirm, showToast } from './dialogs.js';

let deferredPrompt = null;

/** @returns {boolean} */
export function isPwaStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

/** Android / desktop Chrome: el navegador ofrece instalación nativa con un toque. */
export function canNativePwaInstall() {
  return deferredPrompt != null;
}

export function isLikelyMobile() {
  const ua = navigator.userAgent || '';
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return true;
  return window.matchMedia('(max-width: 768px)').matches;
}

/** iPhone/iPad en Safari: no hay diálogo automático; solo instrucciones. */
export function isIosSafariInstallHint() {
  if (isPwaStandalone()) return false;
  const ua = navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|edg\//i.test(ua);
  return isIos && isSafari;
}

/** Muestra el botón de instalar si la app aún no está instalada. */
export function shouldShowInstallButton() {
  return !isPwaStandalone();
}

export function getPwaInstallHintHtml() {
  if (canNativePwaInstall()) {
    return 'Pulsa el botón para añadir GameScore a la pantalla de inicio (como una app).';
  }
  if (isIosSafariInstallHint()) {
    return 'En iPhone/iPad el sistema no permite instalar con un solo toque. Usa el botón y sigue los pasos.';
  }
  return 'Pulsa el botón. Si tu navegador lo permite, verás el diálogo de instalación; si no, te indicamos cómo hacerlo.';
}

function waitForInstallPrompt(timeoutMs = 4500) {
  if (deferredPrompt) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onAvail = () => {
      cleanup();
      resolve(!!deferredPrompt);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('pwa-install-available', onAvail);
    };
    window.addEventListener('pwa-install-available', onAvail);
  });
}

async function showManualInstallGuide() {
  if (isIosSafariInstallHint()) {
    await showConfirm(
      '1. Pulsa Compartir (icono cuadrado con flecha hacia arriba, abajo en Safari).\n\n2. Elige «Añadir a pantalla de inicio».\n\n3. Pulsa «Añadir» arriba a la derecha.',
      {
        title: 'Instalar en iPhone o iPad',
        confirmText: 'Entendido',
        cancelText: 'Cerrar',
        danger: false
      }
    );
    return;
  }
  await showConfirm(
    'En Chrome o Edge: menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio».\n\nSi no aparece, visita la página unos segundos con buena conexión o prueba en Chrome.',
    {
      title: 'Instalar GameScore',
      confirmText: 'Entendido',
      cancelText: 'Cerrar',
      danger: false
    }
  );
}

/** Dispara el diálogo nativo del sistema (Android/Chrome) si está disponible. */
export async function promptPwaInstall() {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') {
      showToast('Instalación completada', { variant: 'success' });
      return true;
    }
    showToast('Instalación cancelada', { variant: 'info' });
    return false;
  } catch {
    deferredPrompt = null;
    return false;
  }
}

/**
 * Acción del botón «Instalar»: espera el aviso del navegador, abre el diálogo nativo
 * o muestra guía manual (iOS / navegadores sin beforeinstallprompt).
 */
export async function requestPwaInstall() {
  if (isPwaStandalone()) {
    showToast('La app ya está instalada', { variant: 'info' });
    return false;
  }

  if (canNativePwaInstall()) {
    return promptPwaInstall();
  }

  showToast('Preparando instalación…', { variant: 'info', duration: 2200 });
  const ready = await waitForInstallPrompt();
  if (ready && canNativePwaInstall()) {
    return promptPwaInstall();
  }

  if (isIosSafariInstallHint()) {
    await showManualInstallGuide();
    return false;
  }

  if (isLikelyMobile()) {
    await showManualInstallGuide();
    return false;
  }

  await showManualInstallGuide();
  return false;
}

function bindInstallButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pwa-install], [data-pwa-install-action]');
    if (!btn) return;
    e.preventDefault();
    void requestPwaInstall();
  });
}

export function initPwaInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToast('GameScore instalada en tu dispositivo', { variant: 'success' });
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
    document.querySelectorAll('[data-pwa-install-card], [data-pwa-install-action]').forEach((el) => {
      el.remove();
    });
  });

  bindInstallButtons();
}

/** HTML del botón principal de instalación (icono + texto). */
export function pwaInstallButtonHtml(extraClass = '') {
  if (!shouldShowInstallButton()) return '';
  return `<button type="button" class="btn btn-install btn-block ${extraClass}" data-pwa-install-action aria-label="Instalar GameScore en este dispositivo">
    <span class="btn-install__inner">
      <svg class="btn-install__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17 18H7v-2h10v2zM19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-7 .5 5-5h-3V3h-4v4.5H7l5 5.5z"/></svg>
      <span>Instalar app</span>
    </span>
  </button>`;
}
