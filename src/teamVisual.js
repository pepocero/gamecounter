export const DEFAULT_COLOR_A = '#C9082A';
export const DEFAULT_COLOR_B = '#17408B';

export function teamColor(match, side) {
  const k = side === 'A' ? 'teamAColor' : 'teamBColor';
  const v = match[k];
  if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  return side === 'A' ? DEFAULT_COLOR_A : DEFAULT_COLOR_B;
}

export function teamImage(match, side) {
  const k = side === 'A' ? 'teamAImage' : 'teamBImage';
  const v = match[k];
  if (typeof v !== 'string' || !v.startsWith('data:image/')) return null;
  return v;
}

export function teamInitial(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  return s.charAt(0).toUpperCase();
}
