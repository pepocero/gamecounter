import { showToast } from './dialogs.js';
import { isIdbMediaRef, putMediaBlob, refToObjectURL } from './mediaStore.js';

const MAX_AUDIO_FILE_BYTES = 5 * 1024 * 1024;
/** Límite de cadena data URL (localStorage / JSON). */
export const MAX_TEAM_AUDIO_DATA_URL_LENGTH = 2_800_000;

export function isSafeTeamAudioDataUrl(s) {
  if (typeof s !== 'string' || s.length > MAX_TEAM_AUDIO_DATA_URL_LENGTH) return false;
  return s.startsWith('data:audio/');
}

/** Data URL o referencia `idb:`. */
export function isUsableTeamAudio(s) {
  return isSafeTeamAudioDataUrl(s) || isIdbMediaRef(s);
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

/** Guarda el archivo de audio en IndexedDB; devuelve `idb:<uuid>`. */
export function fileToAudioRef(file) {
  return new Promise((resolve, reject) => {
    if (!file || typeof file.type !== 'string' || !file.type.startsWith('audio/')) {
      reject(new Error('Selecciona un archivo de audio'));
      return;
    }
    if (file.size > MAX_AUDIO_FILE_BYTES) {
      reject(new Error('El audio es demasiado grande (máx. 5 MB).'));
      return;
    }
    putMediaBlob(file)
      .then((ref) => resolve(ref))
      .catch((e) => reject(e instanceof Error ? e : new Error('No se pudo guardar el audio')));
  });
}

/** Guarda un Blob de audio (p. ej. grabación de micrófono) en IndexedDB. */
export function blobToAudioRef(blob) {
  return new Promise((resolve, reject) => {
    if (!(blob instanceof Blob) || blob.size === 0) {
      reject(new Error('Grabación vacía'));
      return;
    }
    if (blob.size > MAX_AUDIO_FILE_BYTES) {
      reject(new Error('La grabación es demasiado grande (máx. 5 MB).'));
      return;
    }
    putMediaBlob(blob)
      .then((ref) => resolve(ref))
      .catch((e) => reject(e instanceof Error ? e : new Error('No se pudo guardar la grabación')));
  });
}

/** Duración máxima de grabación con micrófono (ms). */
export const MAX_MIC_CHANT_MS = 45_000;

export async function resolveTeamAudioSrc(dataUrlOrRef) {
  if (typeof dataUrlOrRef !== 'string' || !isUsableTeamAudio(dataUrlOrRef)) return null;
  if (isIdbMediaRef(dataUrlOrRef)) return refToObjectURL(dataUrlOrRef);
  return dataUrlOrRef;
}

const MIC_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  ''
];

let micStream = null;
let micRecorder = null;
let micChunks = [];

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const mime of MIC_MIME_CANDIDATES) {
    if (!mime || MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

function releaseMicStream() {
  if (micStream) {
    micStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    micStream = null;
  }
}

export function isMicChantRecording() {
  return micRecorder != null && micRecorder.state === 'recording';
}

export function cancelMicChantRecording() {
  if (micRecorder && micRecorder.state !== 'inactive') {
    try {
      micRecorder.stop();
    } catch {
      /* ignore */
    }
  }
  micRecorder = null;
  micChunks = [];
  releaseMicStream();
}

export async function startMicChantRecording() {
  if (isMicChantRecording()) {
    throw new Error('Ya hay una grabación en curso');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este dispositivo no permite usar el micrófono');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Tu navegador no soporta grabar audio');
  }
  cancelMicChantRecording();
  const mime = pickRecorderMime();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
  }
  micStream = stream;
  micChunks = [];
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  micRecorder = rec;
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) micChunks.push(e.data);
  };
  return new Promise((resolve, reject) => {
    rec.onerror = () => {
      cancelMicChantRecording();
      reject(new Error('Error durante la grabación'));
    };
    rec.onstart = () => resolve(rec.mimeType || mime || 'audio/webm');
    try {
      rec.start(200);
    } catch (e) {
      cancelMicChantRecording();
      reject(e instanceof Error ? e : new Error('No se pudo iniciar la grabación'));
    }
  });
}

export function stopMicChantRecording() {
  if (!micRecorder || micRecorder.state === 'inactive') {
    cancelMicChantRecording();
    return Promise.reject(new Error('No hay grabación activa'));
  }
  return new Promise((resolve, reject) => {
    const rec = micRecorder;
    rec.onstop = async () => {
      const type = rec.mimeType || (micChunks[0] && micChunks[0].type) || 'audio/webm';
      const blob = new Blob(micChunks, { type });
      micRecorder = null;
      micChunks = [];
      releaseMicStream();
      try {
        const ref = await blobToAudioRef(blob);
        resolve(ref);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('No se pudo guardar la grabación'));
      }
    };
    try {
      rec.stop();
    } catch (e) {
      cancelMicChantRecording();
      reject(e instanceof Error ? e : new Error('No se pudo detener la grabación'));
    }
  });
}

let currentAudio = null;
let currentSide = null;
let currentAudioBlobUrl = null;

function revokeCurrentAudioBlobUrl() {
  if (currentAudioBlobUrl) {
    try {
      URL.revokeObjectURL(currentAudioBlobUrl);
    } catch {
      /* ignore */
    }
    currentAudioBlobUrl = null;
  }
}

export function stopTeamChant() {
  revokeCurrentAudioBlobUrl();
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
 * Acepta data URL o referencia `idb:`.
 */
export async function toggleTeamChant(side, dataUrlOrRef) {
  if (side !== 'A' && side !== 'B') return;
  if (currentSide === side && currentAudio) {
    stopTeamChant();
    return;
  }
  stopTeamChant();
  let src = dataUrlOrRef;
  if (typeof dataUrlOrRef === 'string' && isIdbMediaRef(dataUrlOrRef)) {
    const u = await refToObjectURL(dataUrlOrRef);
    if (!u) {
      showToast('No se pudo cargar el audio guardado', { variant: 'error' });
      return;
    }
    currentAudioBlobUrl = u;
    src = u;
  }
  const el = new Audio(src);
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
