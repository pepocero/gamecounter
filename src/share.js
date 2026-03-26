import { computeScores, basketballBreakdown } from './storage.js';
import { teamColor, teamImage, teamInitial } from './teamVisual.js';
import { isSafeDataImageUrl } from './imageUtils.js';

function escapeCanvasText(s) {
  return String(s ?? '').replace(/\n/g, ' ');
}

export function buildShareText(match) {
  const { scoreA, scoreB } = computeScores(match);
  const sport = match.sport === 'soccer' ? 'Fútbol' : 'Baloncesto';
  const date = match.date || '—';
  const place = match.place || '—';
  let body = `🏆 ${sport}\n`;
  body += `${match.teamA} ${scoreA} - ${scoreB} ${match.teamB}\n`;
  body += `📅 ${date}\n📍 ${place}\n`;
  if (match.sport === 'basketball') {
    const bd = basketballBreakdown(match.events);
    body += `\nDetalle ${match.teamA}: TL ${bd.A[1]}, dobles ${bd.A[2]}, triples ${bd.A[3]}\n`;
    body += `Detalle ${match.teamB}: TL ${bd.B[1]}, dobles ${bd.B[2]}, triples ${bd.B[3]}\n`;
  }
  body += `\n— Marcador de partidos`;
  return body;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    i.src = src;
  });
}

function drawTeamCircle(ctx, cx, cy, r, color, img, initial) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img && img.complete && img.naturalWidth) {
    const s = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, cx, cy + 4);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export async function renderMatchSummaryImage(match) {
  const { scoreA, scoreB } = computeScores(match);
  const sport = match.sport === 'soccer' ? 'FÚTBOL' : 'BALONCESTO';
  const w = 1080;
  const h = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const g0 = ctx.createLinearGradient(0, 0, w, h);
  g0.addColorStop(0, '#070d14');
  g0.addColorStop(0.45, '#0c1a2e');
  g0.addColorStop(1, '#05080c');
  ctx.fillStyle = g0;
  ctx.fillRect(0, 0, w, h);

  const cA = teamColor(match, 'A');
  const cB = teamColor(match, 'B');
  const barW = 28;
  ctx.fillStyle = cA;
  ctx.fillRect(0, 0, barW, h);
  ctx.fillStyle = cB;
  ctx.fillRect(w - barW, 0, barW, h);

  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, 0, w, 14);

  ctx.fillStyle = '#e8eef5';
  ctx.font = '600 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FINAL', w / 2, 72);

  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillStyle = '#8da4c0';
  ctx.fillText(escapeCanvasText(`${match.date || '—'}  ·  ${match.place || '—'}`), w / 2, 118);

  ctx.fillStyle = '#c9a227';
  ctx.font = '700 32px system-ui, sans-serif';
  ctx.fillText(sport, w / 2, 168);

  let imgA = null;
  let imgB = null;
  const urlA = teamImage(match, 'A');
  const urlB = teamImage(match, 'B');
  try {
    if (urlA && isSafeDataImageUrl(urlA)) imgA = await loadImageElement(urlA);
  } catch {
    imgA = null;
  }
  try {
    if (urlB && isSafeDataImageUrl(urlB)) imgB = await loadImageElement(urlB);
  } catch {
    imgB = null;
  }

  const rLogo = 100;
  const yLogo = 340;
  drawTeamCircle(ctx, 220, yLogo, rLogo, cA, imgA, teamInitial(match.teamA));
  drawTeamCircle(ctx, w - 220, yLogo, rLogo, cB, imgB, teamInitial(match.teamB));

  ctx.fillStyle = '#f1f5f9';
  ctx.font = '600 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(escapeCanvasText(match.teamA || 'Equipo A'), 220, 490);
  ctx.fillText(escapeCanvasText(match.teamB || 'Equipo B'), w - 220, 490);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 180px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.fillText(`${scoreA}    —    ${scoreB}`, w / 2, 720);
  ctx.shadowBlur = 0;

  if (match.sport === 'basketball') {
    const bd = basketballBreakdown(match.events);
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    let y = 860;
    const line = (txt) => {
      ctx.fillText(escapeCanvasText(txt), w / 2, y);
      y += 44;
    };
    line(`${match.teamA}: TL ${bd.A[1]} · 2 pts ${bd.A[2]} · 3 pts ${bd.A[3]}`);
    line(`${match.teamB}: TL ${bd.B[1]} · 2 pts ${bd.B[2]} · 3 pts ${bd.B[3]}`);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '26px system-ui, sans-serif';
  ctx.fillText('Marcador de partidos · resultado oficial', w / 2, h - 80);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la imagen'));
      },
      'image/png',
      0.92
    );
  });
}

export async function shareMatch(match) {
  const text = buildShareText(match);
  const blob = await renderMatchSummaryImage(match);
  const file = new File([blob], 'resultado-partido.png', { type: 'image/png' });

  const shareWithFiles =
    typeof navigator !== 'undefined' &&
    navigator.share &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));

  if (shareWithFiles) {
    try {
      await navigator.share({
        title: 'Resultado del partido',
        text,
        files: [file]
      });
      return { ok: true, method: 'share' };
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, cancelled: true };
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'Resultado del partido', text });
      return { ok: true, method: 'share-text' };
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, cancelled: true };
    }
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: 'clipboard', text };
    }
  } catch {
    /* fallback below */
  }
  return { ok: false, text };
}

export function downloadImageBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
