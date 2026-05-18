/** Iconos SVG para controles de audio (sin texto, solo accesibilidad con aria-label). */

export function iconMediaPlay() {
  return `<svg class="media-btn__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
}

export function iconMediaPause() {
  return `<svg class="media-btn__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>`;
}

export function iconMediaStop() {
  return `<svg class="media-btn__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 6h12v12H6V6z"/></svg>`;
}

export function iconMediaTrash() {
  return `<svg class="media-btn__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/></svg>`;
}
