/**
 * Fecha de partido guardada como YYYY-MM-DD (input type="date") → dd/mm/aaaa (España).
 * Si no coincide el patrón ISO, devuelve el texto tal cual (o fallback si está vacío).
 */
export function formatDateES(isoOrText, emptyFallback = '—') {
  if (isoOrText == null || isoOrText === '') return emptyFallback;
  const s = String(isoOrText).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return s || emptyFallback;
}
