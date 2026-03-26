import { showToast } from './dialogs.js';

const MAX_AUDIO_FILE_BYTES = 5 * 1024 * 1024;
/** Límite de cadena data URL (localStorage / JSON). */
export const MAX_TEAM_AUDIO_DATA_URL_LENGTH = 2_800_000;

export function isSafeTeamAudioDataUrl(s) {
  if (typeof s !== 'string' || s.length > MAX_TEAM_AUDIO_DATA_URL_LENGTH) return false;
  return s.startsWith('data:audio/');
}

export function fileToAudioDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || typeof file.type !== 'string' || !file.type.startsWith('audio/')) {
      reject(new Error('Selecciona un archivo de audio'));
      return;
    }
    if (file.size > MAX_AUDIO_FILE_BYTES) {
      reject(new Error('El audio es demasiado grande (máx. 5 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('No se pudo leer el audio'));
        return;
      }
      if (!isSafeTeamAudioDataUrl(dataUrl)) {
        reject(new Error('Formato no compatible o archivo demasiado grande para guardar.'));
        return;
      }
      resolve(dataUrl);
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

let currentAudio = null;
let currentSide = null;

export function stopTeamChant() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.removeAttribute('src');
      currentAudio.load();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  currentSide = null;
}

/**
 * Si ya suena ese equipo, para. Si no, para el otro y reproduce este.
 */
export function toggleTeamChant(side, dataUrl) {
  if (side !== 'A' && side !== 'B') return;
  if (currentSide === side && currentAudio) {
    stopTeamChant();
    return;
  }
  stopTeamChant();
  const el = new Audio(dataUrl);
  currentAudio = el;
  currentSide = side;
  const done = () => {
    if (currentAudio === el) stopTeamChant();
  };
  el.addEventListener('ended', done);
  el.addEventListener('error', () => {
    showToast('No se pudo reproducir el audio', { variant: 'error' });
    done();
  });
  const p = el.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {
      showToast('No se pudo reproducir el audio (revisa el volumen o el archivo)', { variant: 'error' });
      stopTeamChant();
    });
  }
}
