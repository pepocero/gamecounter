import './style.css';
import { registerSW } from 'virtual:pwa-register';
import {
  loadMatches,
  saveMatch,
  getMatch,
  newId,
  computeScores,
  aggregateStats,
  basketballBreakdown,
  removeLastScoringEvent,
  loadSavedTeams,
  saveSavedTeam,
  deleteSavedTeam,
  getSavedTeam,
  buildExportPayload,
  applyImportPayload,
  deleteMatch
} from './storage.js';
import {
  buildShareText,
  renderMatchSummaryImage,
  shareMatch,
  downloadImageBlob
} from './share.js';
import { teamColor, teamImage, teamInitial, DEFAULT_COLOR_A, DEFAULT_COLOR_B } from './teamVisual.js';
import { fileToResizedJpegDataUrl, isSafeDataImageUrl } from './imageUtils.js';
import { showToast, showConfirm } from './dialogs.js';

function whatsAppTextUrl(text) {
  const q = encodeURIComponent(text);
  return `https://wa.me/?text=${q}`;
}

registerSW({ immediate: true });

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function savedTeamOptionsHtml() {
  const teams = loadSavedTeams();
  let html = '<option value="">— Equipo manual —</option>';
  for (const t of teams) {
    html += `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`;
  }
  return html;
}

function downloadJsonFile(filename, jsonString) {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayISODate() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseRoute() {
  const h = (location.hash || '#home').replace(/^#/, '') || 'home';
  const parts = h.split('/').filter(Boolean);
  return { name: parts[0] || 'home', id: parts[1] || null };
}

function navigate(name, id) {
  if (id) location.hash = `#${name}/${id}`;
  else location.hash = `#${name}`;
}

function setPageClass(name) {
  const app = document.getElementById('app');
  if (!app) return;
  const map = {
    home: 'page-home',
    new: 'page-new',
    live: 'page-live',
    share: 'page-share',
    history: 'page-history',
    stats: 'page-stats',
    settings: 'page-settings',
    teams: 'page-teams',
    upcoming: 'page-upcoming'
  };
  app.className = map[name] || 'page-home';
}

function attachTeamBadgeSlot(slot, match, side) {
  if (!slot) return;
  const color = teamColor(match, side);
  const url = teamImage(match, side);
  const name = side === 'A' ? match.teamA : match.teamB;
  slot.innerHTML = '';
  if (url && isSafeDataImageUrl(url)) {
    const wrap = document.createElement('div');
    wrap.className = 'team-badge';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    wrap.appendChild(img);
    slot.appendChild(wrap);
  } else {
    const div = document.createElement('div');
    div.className = 'team-badge jersey-fallback';
    div.style.setProperty('--jersey-c', color);
    const span = document.createElement('span');
    span.className = 'jersey-initial';
    span.textContent = teamInitial(name);
    div.appendChild(span);
    slot.appendChild(div);
  }
}

function attachTeamBadges(match) {
  document.querySelectorAll('[data-team-badge]').forEach((slot) => {
    const side = slot.getAttribute('data-team-badge');
    if (side === 'A' || side === 'B') attachTeamBadgeSlot(slot, match, side);
  });
}

function render() {
  const { name, id } = parseRoute();
  const app = document.getElementById('app');
  if (!app) return;

  if (name === 'home') {
    setPageClass('home');
    app.innerHTML = viewHome();
    bindHome();
    return;
  }
  if (name === 'new') {
    setPageClass('new');
    app.innerHTML = viewNew();
    bindNew();
    return;
  }
  if (name === 'live' && id) {
    const m = getMatch(id);
    if (!m || m.status !== 'live') {
      navigate('home');
      return;
    }
    setPageClass('live');
    app.innerHTML = viewLive(m);
    attachTeamBadges(m);
    bindLive(m);
    return;
  }
  if (name === 'share' && id) {
    const m = getMatch(id);
    if (!m || m.status !== 'finished') {
      navigate('home');
      return;
    }
    setPageClass('share');
    app.innerHTML = viewShare(m);
    attachTeamBadges(m);
    bindShare(m);
    return;
  }
  if (name === 'history') {
    setPageClass('history');
    app.innerHTML = viewHistory();
    bindHistory();
    return;
  }
  if (name === 'stats') {
    setPageClass('stats');
    if (id && id !== 'soccer' && id !== 'basketball') {
      navigate('stats');
      return;
    }
    if (id === 'soccer' || id === 'basketball') {
      app.innerHTML = viewStatsBySport(id);
      bindStatsBySport();
      return;
    }
    app.innerHTML = viewStats();
    bindStats();
    return;
  }
  if (name === 'settings') {
    setPageClass('settings');
    app.innerHTML = viewSettings();
    bindSettings();
    return;
  }
  if (name === 'teams') {
    setPageClass('teams');
    app.innerHTML = viewTeams();
    bindTeams();
    return;
  }
  if (name === 'upcoming') {
    setPageClass('upcoming');
    app.innerHTML = viewUpcoming();
    bindUpcoming();
    return;
  }
  navigate('home');
}

function viewHome() {
  const scheduledCount = loadMatches().filter((m) => m.status === 'scheduled').length;
  const upcomingBanner =
    scheduledCount > 0
      ? `
    <button type="button" class="home-upcoming-banner" data-act="upcoming">
      <span class="home-upcoming-count" aria-hidden="true">${scheduledCount}</span>
      <span class="home-upcoming-copy">
        <strong>${scheduledCount === 1 ? 'Partido programado' : 'Partidos programados'}</strong>
        <small>${scheduledCount === 1 ? 'Toca para abrir y comenzar cuando llegue el momento' : 'Toca para ver la lista e iniciar el marcador'}</small>
      </span>
      <span class="home-upcoming-chevron" aria-hidden="true">›</span>
    </button>`
      : '';

  return `
    <div class="hero-brand">
      <p class="eyebrow">LIVE SCOREBOARD</p>
      <div class="logo-line" aria-hidden="true"></div>
    </div>
    <h1>Marcador de partidos</h1>
    <p class="msg">Estilo transmisión oficial: fútbol o baloncesto. Tus datos solo en este dispositivo.</p>
    ${upcomingBanner}
    <div class="stack">
      <button type="button" class="btn btn-primary btn-block" data-act="new">Nuevo partido</button>
      <button type="button" class="btn btn-block" data-act="upcoming">Próximos partidos</button>
      <button type="button" class="btn btn-block" data-act="history">Historial</button>
      <button type="button" class="btn btn-block" data-act="stats">Estadísticas</button>
      <button type="button" class="btn btn-block" data-act="settings">Configuración</button>
    </div>
  `;
}

function bindHome() {
  document.getElementById('app').onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.getAttribute('data-act');
    if (act === 'new') navigate('new');
    if (act === 'upcoming') navigate('upcoming');
    if (act === 'history') navigate('history');
    if (act === 'stats') navigate('stats');
    if (act === 'settings') navigate('settings');
  };
}

function viewNew() {
  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-back>← Inicio</button>
    </div>
    <div class="hero-brand" style="padding-top:0;">
      <p class="eyebrow">CONFIGURAR PARTIDO</p>
      <div class="logo-line" aria-hidden="true"></div>
    </div>
    <h1>Nuevo partido</h1>
    <form class="stack" id="form-new">
      <div class="card">
        <label for="sport">Deporte</label>
        <select id="sport" name="sport" required>
          <option value="basketball" selected>Baloncesto</option>
          <option value="soccer">Fútbol</option>
        </select>
      </div>

      <div class="team-setup team-setup--home">
        <div class="team-setup-banner">
          <span class="team-setup-pill team-setup-pill--home">Local</span>
          <span class="team-setup-hint">Cancha propia</span>
        </div>
        <h3>Equipo A</h3>
        <div>
          <label for="savedPickA">Usar equipo guardado</label>
          <select id="savedPickA">${savedTeamOptionsHtml()}</select>
        </div>
        <div>
          <label for="teamA">Nombre</label>
          <input id="teamA" name="teamA" required maxlength="80" autocomplete="off" placeholder="Ej. Los Lakers" />
        </div>
        <div style="margin-top:12px;">
          <label for="teamAColor">Color del equipo</label>
          <input type="color" id="teamAColor" name="teamAColor" value="${DEFAULT_COLOR_A}" />
        </div>
        <div style="margin-top:12px;">
          <label for="fileTeamA">Escudo o camiseta (opcional)</label>
          <input type="file" id="fileTeamA" accept="image/*" />
          <p class="preview-hint">Si subes imagen, se muestra en el marcador; si no, se usa el color con la inicial.</p>
        </div>
        <div class="preview-row">
          <div class="team-badge-slot" style="width:72px;height:72px;" id="previewSlotA"></div>
          <button type="button" class="btn btn-ghost" id="clearImgA" style="min-height:44px;">Quitar imagen</button>
        </div>
      </div>

      <div class="team-setup team-setup--away">
        <div class="team-setup-banner">
          <span class="team-setup-pill team-setup-pill--away">Visitante</span>
          <span class="team-setup-hint">Equipo rival</span>
        </div>
        <h3>Equipo B</h3>
        <div>
          <label for="savedPickB">Usar equipo guardado</label>
          <select id="savedPickB">${savedTeamOptionsHtml()}</select>
        </div>
        <div>
          <label for="teamB">Nombre</label>
          <input id="teamB" name="teamB" required maxlength="80" autocomplete="off" placeholder="Ej. Celtics" />
        </div>
        <div style="margin-top:12px;">
          <label for="teamBColor">Color del equipo</label>
          <input type="color" id="teamBColor" name="teamBColor" value="${DEFAULT_COLOR_B}" />
        </div>
        <div style="margin-top:12px;">
          <label for="fileTeamB">Escudo o camiseta (opcional)</label>
          <input type="file" id="fileTeamB" accept="image/*" />
        </div>
        <div class="preview-row">
          <div class="team-badge-slot" style="width:72px;height:72px;" id="previewSlotB"></div>
          <button type="button" class="btn btn-ghost" id="clearImgB" style="min-height:44px;">Quitar imagen</button>
        </div>
      </div>

      <div class="card">
        <div>
          <label for="date">Fecha del partido</label>
          <input id="date" name="date" type="date" required value="${escapeHtml(todayISODate())}" />
        </div>
        <div style="margin-top:12px;">
          <label for="place">Lugar / pabellón</label>
          <input id="place" name="place" maxlength="120" autocomplete="off" placeholder="Arena, cancha, ciudad…" />
        </div>
      </div>
      <p class="msg new-match-hint">Programa el partido para otro día o empieza el marcador ya.</p>
      <div class="stack new-match-actions">
        <button type="submit" name="formAction" value="schedule" class="btn btn-primary btn-block">Programar partido</button>
        <button type="submit" name="formAction" value="live" class="btn btn-block">Comenzar partido ahora</button>
      </div>
    </form>
  `;
}

function bindNew() {
  const app = document.getElementById('app');
  const pending = { teamAImage: null, teamBImage: null };

  function getPreviewMatch() {
    return {
      teamA: app.querySelector('#teamA')?.value || 'Equipo A',
      teamB: app.querySelector('#teamB')?.value || 'Equipo B',
      teamAColor: app.querySelector('#teamAColor')?.value || DEFAULT_COLOR_A,
      teamBColor: app.querySelector('#teamBColor')?.value || DEFAULT_COLOR_B,
      teamAImage: pending.teamAImage,
      teamBImage: pending.teamBImage
    };
  }

  function refreshPreview(side) {
    const id = side === 'A' ? 'previewSlotA' : 'previewSlotB';
    const slot = app.querySelector(`#${id}`);
    attachTeamBadgeSlot(slot, getPreviewMatch(), side);
  }

  app.querySelector('[data-back]').onclick = () => navigate('home');

  function applySavedTeam(side, teamId) {
    if (!teamId) return;
    const t = getSavedTeam(teamId);
    if (!t) return;
    if (side === 'A') {
      app.querySelector('#teamA').value = t.name;
      app.querySelector('#teamAColor').value = t.color;
      pending.teamAImage = t.image && isSafeDataImageUrl(t.image) ? t.image : null;
      app.querySelector('#fileTeamA').value = '';
    } else {
      app.querySelector('#teamB').value = t.name;
      app.querySelector('#teamBColor').value = t.color;
      pending.teamBImage = t.image && isSafeDataImageUrl(t.image) ? t.image : null;
      app.querySelector('#fileTeamB').value = '';
    }
    refreshPreview('A');
    refreshPreview('B');
  }

  app.querySelector('#savedPickA').addEventListener('change', (e) => {
    const v = e.target.value;
    if (v) applySavedTeam('A', v);
  });
  app.querySelector('#savedPickB').addEventListener('change', (e) => {
    const v = e.target.value;
    if (v) applySavedTeam('B', v);
  });

  app.querySelector('#fileTeamA').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      pending.teamAImage = await fileToResizedJpegDataUrl(f);
      refreshPreview('A');
    } catch (err) {
      showToast(err.message || 'No se pudo cargar la imagen', { variant: 'error' });
      e.target.value = '';
    }
  };
  app.querySelector('#fileTeamB').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      pending.teamBImage = await fileToResizedJpegDataUrl(f);
      refreshPreview('B');
    } catch (err) {
      showToast(err.message || 'No se pudo cargar la imagen', { variant: 'error' });
      e.target.value = '';
    }
  };

  app.querySelector('#clearImgA').onclick = () => {
    pending.teamAImage = null;
    app.querySelector('#fileTeamA').value = '';
    refreshPreview('A');
  };
  app.querySelector('#clearImgB').onclick = () => {
    pending.teamBImage = null;
    app.querySelector('#fileTeamB').value = '';
    refreshPreview('B');
  };

  ['#teamA', '#teamB', '#teamAColor', '#teamBColor'].forEach((sel) => {
    const el = app.querySelector(sel);
    el.addEventListener('input', () => {
      refreshPreview('A');
      refreshPreview('B');
    });
  });

  refreshPreview('A');
  refreshPreview('B');

  app.querySelector('#form-new').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const formAction = String(fd.get('formAction') || 'live');
    const schedule = formAction === 'schedule';
    const sport = fd.get('sport');
    const teamA = String(fd.get('teamA') || '').trim();
    const teamB = String(fd.get('teamB') || '').trim();
    const date = String(fd.get('date') || '').trim();
    const place = String(fd.get('place') || '').trim();
    let teamAColor = String(fd.get('teamAColor') || '').trim();
    let teamBColor = String(fd.get('teamBColor') || '').trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(teamAColor)) teamAColor = DEFAULT_COLOR_A;
    if (!/^#[0-9A-Fa-f]{6}$/.test(teamBColor)) teamBColor = DEFAULT_COLOR_B;
    if (!teamA || !teamB || !date) return;

    const now = Date.now();
    const match = {
      id: newId(),
      sport,
      teamA,
      teamB,
      teamAColor,
      teamBColor,
      teamAImage: pending.teamAImage && isSafeDataImageUrl(pending.teamAImage) ? pending.teamAImage : null,
      teamBImage: pending.teamBImage && isSafeDataImageUrl(pending.teamBImage) ? pending.teamBImage : null,
      date,
      place,
      events: [],
      status: schedule ? 'scheduled' : 'live',
      startedAt: schedule ? null : now,
      endedAt: null,
      createdAt: now
    };
    saveMatch(match);
    if (schedule) {
      showToast('Partido guardado en Próximos partidos.', { variant: 'success' });
      navigate('upcoming');
    } else {
      navigate('live', match.id);
    }
  };
}

function viewLive(m) {
  const { scoreA, scoreB } = computeScores(m);
  const isSoccer = m.sport === 'soccer';
  const sportLabel = isSoccer ? 'FÚTBOL' : 'BALONCESTO';
  const ptsA = isSoccer
    ? `<button type="button" class="btn btn-pt" data-team="A" data-pt="1">Gol +1</button>`
    : `
      <div class="point-grid">
        <button type="button" class="btn btn-pt" data-team="A" data-pt="1">+1</button>
        <button type="button" class="btn btn-pt" data-team="A" data-pt="2">+2</button>
        <button type="button" class="btn btn-pt" data-team="A" data-pt="3">+3</button>
      </div>`;
  const ptsB = isSoccer
    ? `<button type="button" class="btn btn-pt" data-team="B" data-pt="1">Gol +1</button>`
    : `
      <div class="point-grid">
        <button type="button" class="btn btn-pt" data-team="B" data-pt="1">+1</button>
        <button type="button" class="btn btn-pt" data-team="B" data-pt="2">+2</button>
        <button type="button" class="btn btn-pt" data-team="B" data-pt="3">+3</button>
      </div>`;

  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-abort>Salir</button>
    </div>
    <div class="broadcast-wrap">
      <div class="broadcast-top">
        <span>● LIVE</span>
        <span>${sportLabel}</span>
      </div>
      <div class="broadcast-meta">${escapeHtml(m.date)} · ${escapeHtml(m.place || '—')}</div>
      <div class="broadcast-scores">
        <div class="team-col">
          <div class="team-badge-slot" data-team-badge="A"></div>
          <div class="team-name-broadcast">${escapeHtml(m.teamA)}</div>
          <div class="${isSoccer ? 'point-grid soccer' : ''}">${ptsA}</div>
        </div>
        <div class="score-mega">
          ${scoreA}<span class="score-sep"> </span><span class="score-sep">—</span><span class="score-sep"> </span>${scoreB}
        </div>
        <div class="team-col">
          <div class="team-badge-slot" data-team-badge="B"></div>
          <div class="team-name-broadcast">${escapeHtml(m.teamB)}</div>
          <div class="${isSoccer ? 'point-grid soccer' : ''}">${ptsB}</div>
        </div>
      </div>
      <div class="broadcast-actions">
        <p class="point-hint">Toca para sumar · <strong>Mantén apretado</strong> para restar la última anotación de ese tipo</p>
        <button type="button" class="btn btn-danger btn-block" data-end>Fin de partido</button>
      </div>
    </div>
  `;
}

const LONG_PRESS_MS = 520;

function validatePointButton(m, team, pt) {
  if (team !== 'A' && team !== 'B') return false;
  if (m.sport === 'soccer' && pt !== 1) return false;
  if (m.sport === 'basketball' && ![1, 2, 3].includes(pt)) return false;
  return true;
}

function refreshLiveView(app, matchId) {
  const cur = getMatch(matchId);
  if (!cur || cur.status !== 'live') return;
  app.innerHTML = viewLive(cur);
  attachTeamBadges(cur);
  bindLive(cur);
}

function bindScoreButtons(app, m) {
  const buttons = app.querySelectorAll('.broadcast-wrap [data-team][data-pt]');
  buttons.forEach((btn) => {
    let pressTimer = null;
    let longPressFired = false;

    const applyAdd = () => {
      const team = btn.getAttribute('data-team');
      const pt = parseInt(btn.getAttribute('data-pt'), 10);
      if (!validatePointButton(m, team, pt)) return;
      const cur = getMatch(m.id);
      if (!cur || cur.status !== 'live') return;
      cur.events = cur.events || [];
      cur.events.push({ team, points: pt, at: Date.now() });
      saveMatch(cur);
      refreshLiveView(app, m.id);
    };

    const clearTimer = () => {
      if (pressTimer != null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const team = btn.getAttribute('data-team');
      const pt = parseInt(btn.getAttribute('data-pt'), 10);
      if (!validatePointButton(m, team, pt)) return;
      longPressFired = false;
      clearTimer();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pressTimer = window.setTimeout(() => {
        pressTimer = null;
        longPressFired = true;
        const ok = removeLastScoringEvent(m.id, team, pt);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          if (ok) navigator.vibrate(25);
          else navigator.vibrate([15, 40, 15]);
        }
        /* La vista se actualiza en pointerup para no soltar el dedo sobre un botón nuevo y sumar de más */
      }, LONG_PRESS_MS);
    });

    btn.addEventListener('pointerup', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      clearTimer();
      if (longPressFired) {
        longPressFired = false;
        refreshLiveView(app, m.id);
        return;
      }
      applyAdd();
    });

    btn.addEventListener('pointercancel', clearTimer);

    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      applyAdd();
    });

    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

function bindLive(m) {
  const app = document.getElementById('app');
  app.querySelector('[data-abort]').onclick = async () => {
    const ok = await showConfirm(
      'El partido quedará en curso. Podrás continuar desde Historial cuando quieras.',
      {
        title: '¿Salir del partido?',
        confirmText: 'Salir',
        cancelText: 'Seguir jugando'
      }
    );
    if (ok) navigate('home');
  };

  app.onclick = async (e) => {
    const end = e.target.closest('[data-end]');
    if (end) {
      const ok = await showConfirm('Se guardará el marcador final y podrás compartir el resultado por WhatsApp.', {
        title: '¿Finalizar partido?',
        confirmText: 'Finalizar',
        cancelText: 'Cancelar',
        danger: false
      });
      if (!ok) return;
      const cur = getMatch(m.id);
      if (!cur) return;
      cur.status = 'finished';
      cur.endedAt = Date.now();
      saveMatch(cur);
      navigate('share', m.id);
      return;
    }
  };

  bindScoreButtons(app, m);
}

function viewShare(m) {
  const { scoreA, scoreB } = computeScores(m);
  let detail = '';
  if (m.sport === 'basketball') {
    const bd = basketballBreakdown(m.events);
    detail = `
      <div class="card" style="margin-top:12px;">
        <h2>Detalle de puntos</h2>
        <p style="margin:0;font-size:0.95rem;line-height:1.5;">
          ${escapeHtml(m.teamA)}: TL ${bd.A[1]}, dobles ${bd.A[2]}, triples ${bd.A[3]}<br/>
          ${escapeHtml(m.teamB)}: TL ${bd.B[1]}, dobles ${bd.B[2]}, triples ${bd.B[3]}
        </p>
      </div>`;
  }
  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-home>Inicio</button>
    </div>
    <div class="hero-brand" style="padding-top:0;">
      <p class="eyebrow">FINAL</p>
      <div class="logo-line" aria-hidden="true"></div>
    </div>
    <h1>Partido finalizado</h1>
    <div class="card">
      <div class="share-headline">
        <div class="share-team-mini"><div class="team-badge-slot" data-team-badge="A"></div></div>
        <div>
          <div class="share-score-line">${scoreA} — ${scoreB}</div>
          <p style="margin:6px 0 0;font-size:0.9rem;color:var(--muted);text-align:center;">${escapeHtml(m.date)} · ${escapeHtml(m.place || '—')}</p>
        </div>
        <div class="share-team-mini"><div class="team-badge-slot" data-team-badge="B"></div></div>
      </div>
      <p style="margin:12px 0 0;text-align:center;font-weight:700;font-size:1.05rem;text-transform:uppercase;letter-spacing:0.06em;">
        ${escapeHtml(m.teamA)} <span style="color:var(--muted);">vs</span> ${escapeHtml(m.teamB)}
      </p>
    </div>
    ${detail}
    <p class="msg" id="share-msg" style="display:none;"></p>
    <div class="stack" style="margin-top: 16px;">
      <button type="button" class="btn btn-primary btn-block" data-share-wa>Compartir por WhatsApp</button>
      <a class="btn btn-block" data-wa-link style="text-decoration:none;" target="_blank" rel="noopener noreferrer">Abrir WhatsApp con el texto</a>
      <button type="button" class="btn btn-block" data-dl-img>Descargar imagen del resultado</button>
      <button type="button" class="btn btn-block" data-copy>Copiar texto</button>
    </div>
    <img alt="" class="preview-img" id="preview-img" style="display:none;" />
  `;
}

function bindShare(m) {
  const app = document.getElementById('app');
  let previewUrl = null;

  async function showPreview() {
    const img = app.querySelector('#preview-img');
    try {
      const blob = await renderMatchSummaryImage(m);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      img.src = previewUrl;
      img.style.display = 'block';
    } catch {
      img.style.display = 'none';
    }
  }

  showPreview();

  const waLink = app.querySelector('[data-wa-link]');
  waLink.setAttribute('href', whatsAppTextUrl(buildShareText(m)));

  app.querySelector('[data-home]').onclick = () => navigate('home');

  app.querySelector('[data-share-wa]').onclick = async () => {
    const msg = app.querySelector('#share-msg');
    const r = await shareMatch(m);
    if (r.cancelled) return;
    msg.style.display = 'block';
    if (r.ok) {
      msg.className = 'msg ok';
      if (r.method === 'clipboard') msg.textContent = 'Texto copiado al portapapeles (comparte desde WhatsApp pegando).';
      else msg.textContent = 'Listo. Si no se abrió WhatsApp, usa “Copiar texto” o “Descargar imagen”.';
    } else {
      msg.className = 'msg';
      msg.textContent = 'No se pudo compartir automáticamente. Usa Copiar texto o Descargar imagen.';
    }
  };

  app.querySelector('[data-dl-img]').onclick = async () => {
    const blob = await renderMatchSummaryImage(m);
    downloadImageBlob(blob, 'resultado-partido.png');
  };

  app.querySelector('[data-copy]').onclick = async () => {
    const text = buildShareText(m);
    try {
      await navigator.clipboard.writeText(text);
      const msg = app.querySelector('#share-msg');
      msg.style.display = 'block';
      msg.className = 'msg ok';
      msg.textContent = 'Texto copiado. Pégalo en WhatsApp.';
    } catch {
      const msg = app.querySelector('#share-msg');
      msg.style.display = 'block';
      msg.className = 'msg';
      msg.textContent = text;
    }
  };
}

function viewHistory() {
  const matches = loadMatches()
    .filter((m) => m.status !== 'scheduled')
    .sort((a, b) => (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt));
  if (matches.length === 0) {
    return `
      <div class="topbar">
        <button type="button" class="btn btn-ghost back" data-back>← Inicio</button>
      </div>
      <h1>Historial</h1>
      <p class="msg">No hay partidos guardados.</p>
    `;
  }
  const rows = matches
    .map((m) => {
      const { scoreA, scoreB } = computeScores(m);
      const sp = m.sport === 'soccer' ? 'Fútbol' : 'Baloncesto';
      const st = m.status === 'live' ? 'En curso' : 'Finalizado';
      return `
        <button type="button" class="list-item" data-open="${escapeHtml(m.id)}">
          <span class="list-mini-badge" data-history-badge="A" data-mid="${escapeHtml(m.id)}"></span>
          <span class="list-item-text">
            ${escapeHtml(m.teamA)} ${scoreA} - ${scoreB} ${escapeHtml(m.teamB)}
            <small>${escapeHtml(sp)} · ${escapeHtml(m.date)} · ${escapeHtml(st)}</small>
          </span>
          <span class="list-mini-badge" data-history-badge="B" data-mid="${escapeHtml(m.id)}"></span>
        </button>`;
    })
    .join('');
  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-back>← Inicio</button>
    </div>
    <h1>Historial</h1>
    <div class="stack">${rows}</div>
  `;
}

function bindHistory() {
  const app = document.getElementById('app');
  app.querySelector('[data-back]').onclick = () => navigate('home');

  app.querySelectorAll('[data-history-badge]').forEach((el) => {
    const id = el.getAttribute('data-mid');
    const side = el.getAttribute('data-history-badge');
    const match = getMatch(id);
    if (!match || (side !== 'A' && side !== 'B')) return;
    attachTeamBadgeSlot(el, match, side);
  });

  app.onclick = (e) => {
    const item = e.target.closest('[data-open]');
    if (!item) return;
    const id = item.getAttribute('data-open');
    const m = getMatch(id);
    if (!m) return;
    if (m.status === 'live') navigate('live', id);
    else navigate('share', id);
  };
}

function upcomingMatchesSorted() {
  return loadMatches()
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (da !== db) return da.localeCompare(db);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
}

function viewUpcoming() {
  const list = upcomingMatchesSorted();
  if (list.length === 0) {
    return `
      <div class="topbar">
        <button type="button" class="btn btn-ghost back" data-back>← Inicio</button>
      </div>
      <h1>Próximos partidos</h1>
      <p class="msg">No hay partidos programados. En <strong>Nuevo partido</strong> elige <strong>Programar partido</strong> para guardar equipos, fecha y lugar; aquí podrás iniciar el marcador cuando llegue el momento.</p>
      <button type="button" class="btn btn-primary btn-block" data-go-new>Nuevo partido</button>
    `;
  }
  const rows = list
    .map((m) => {
      const sp = m.sport === 'soccer' ? 'Fútbol' : 'Baloncesto';
      return `
        <div class="card upcoming-card">
          <div class="upcoming-card__head">
            <span class="upcoming-badge">Programado</span>
            <span class="upcoming-date">${escapeHtml(m.date)}</span>
          </div>
          <p class="upcoming-place">${escapeHtml(m.place || 'Sin lugar')}</p>
          <div class="upcoming-teams">
            <div class="upcoming-team">
              <div class="team-badge-slot" data-up-badge="A" data-up-mid="${String(m.id).replace(/"/g, '')}" style="width:52px;height:52px;"></div>
              <span>${escapeHtml(m.teamA)}</span>
            </div>
            <span class="upcoming-vs">vs</span>
            <div class="upcoming-team">
              <div class="team-badge-slot" data-up-badge="B" data-up-mid="${String(m.id).replace(/"/g, '')}" style="width:52px;height:52px;"></div>
              <span>${escapeHtml(m.teamB)}</span>
            </div>
          </div>
          <p class="upcoming-sport">${escapeHtml(sp)}</p>
          <div class="upcoming-actions">
            <button type="button" class="btn btn-primary btn-block" data-start-match="${escapeHtml(m.id)}">Comenzar partido</button>
            <button type="button" class="btn btn-ghost btn-block" data-delete-upcoming="${escapeHtml(m.id)}">Eliminar programación</button>
          </div>
        </div>`;
    })
    .join('');
  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-back>← Inicio</button>
    </div>
    <h1>Próximos partidos</h1>
    <p class="msg">Toca <strong>Comenzar partido</strong> cuando estés en la cancha para abrir el marcador en vivo.</p>
    <div class="stack upcoming-list">${rows}</div>
  `;
}

function bindUpcoming() {
  const app = document.getElementById('app');
  app.querySelector('[data-back]')?.addEventListener('click', () => navigate('home'));
  app.querySelector('[data-go-new]')?.addEventListener('click', () => navigate('new'));

  upcomingMatchesSorted().forEach((m) => {
    ['A', 'B'].forEach((side) => {
      const slot = app.querySelector(`[data-up-badge="${side}"][data-up-mid="${m.id}"]`);
      if (slot) attachTeamBadgeSlot(slot, m, side);
    });
  });

  app.querySelectorAll('[data-start-match]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-start-match');
      const cur = getMatch(id);
      if (!cur || cur.status !== 'scheduled') return;
      cur.status = 'live';
      cur.startedAt = Date.now();
      saveMatch(cur);
      navigate('live', id);
    });
  });

  app.querySelectorAll('[data-delete-upcoming]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-upcoming');
      const cur = getMatch(id);
      if (!cur || cur.status !== 'scheduled') return;
      const ok = await showConfirm('Se eliminará este partido programado (no afecta a partidos ya jugados).', {
        title: '¿Eliminar programación?',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        danger: true
      });
      if (!ok) return;
      deleteMatch(id);
      showToast('Programación eliminada', { variant: 'success' });
      render();
    });
  });
}

function viewStats() {
  const matches = loadMatches();
  const s = aggregateStats(matches);
  const wins = Object.entries(s.teamWins)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, n]) => `<li>${escapeHtml(name)}: <strong>${n}</strong> victorias</li>`)
    .join('');
  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-back>← Inicio</button>
    </div>
    <h1>Estadísticas</h1>
    <p class="msg">Solo partidos finalizados. Empates no suman victoria. Toca Fútbol o Baloncesto para ver cada partido.</p>
    <div class="stat-grid stat-grid--main" style="margin-top: 12px;">
      <div class="stat-box stat-box--static stat-box--span-2"><strong>${s.totalMatches}</strong><span style="color:var(--muted); font-size:0.85rem;">Partidos totales</span></div>
      <button type="button" class="stat-box stat-box--sport stat-box--soccer" data-stats-sport="soccer">
        <strong>${s.totalSoccer}</strong>
        <span style="color:var(--muted); font-size:0.85rem;">Partidos · Fútbol</span>
        <span class="stat-box__cta">Ver detalle ›</span>
      </button>
      <button type="button" class="stat-box stat-box--sport stat-box--basket" data-stats-sport="basketball">
        <strong>${s.totalBasket}</strong>
        <span style="color:var(--muted); font-size:0.85rem;">Partidos · Baloncesto</span>
        <span class="stat-box__cta">Ver detalle ›</span>
      </button>
      <div class="stat-box stat-box--static"><strong>${s.goalsSoccer}</strong><span style="color:var(--muted); font-size:0.85rem;">Goles (fútbol)</span></div>
      <div class="stat-box stat-box--static"><strong>${s.pointsBasket}</strong><span style="color:var(--muted); font-size:0.85rem;">Puntos (baloncesto)</span></div>
    </div>
    <div class="card" style="margin-top: 16px;">
      <h2>Victorias por nombre de equipo</h2>
      ${wins ? `<ul style="margin:0; padding-left: 1.2rem;">${wins}</ul>` : '<p style="color:var(--muted); margin:0;">Sin datos aún.</p>'}
    </div>
  `;
}

function bindStats() {
  const app = document.getElementById('app');
  app.querySelector('[data-back]').onclick = () => navigate('home');
  app.querySelectorAll('[data-stats-sport]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sport = btn.getAttribute('data-stats-sport');
      if (sport === 'soccer' || sport === 'basketball') navigate('stats', sport);
    });
  });
}

function finishedMatchesBySport(sport) {
  return loadMatches()
    .filter((m) => m.status === 'finished' && m.sport === sport)
    .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
}

function formatEndedAt(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function viewStatsBySport(sport) {
  const label = sport === 'soccer' ? 'Fútbol' : 'Baloncesto';
  const list = finishedMatchesBySport(sport);
  if (list.length === 0) {
    return `
      <div class="topbar">
        <button type="button" class="btn btn-ghost back" data-back-stats>← Estadísticas</button>
      </div>
      <h1>${label}</h1>
      <p class="msg">No hay partidos finalizados de ${label.toLowerCase()}. Cuando termines partidos, aparecerán aquí con fecha, lugar y resultado.</p>
    `;
  }
  const rows = list
    .map((m) => {
      const { scoreA, scoreB } = computeScores(m);
      let extra = '';
      if (sport === 'basketball') {
        const bd = basketballBreakdown(m.events);
        extra = `<div class="stats-detail-extra">Tandas 1·2·3 pts: ${bd.A[1] + bd.B[1]} · ${bd.A[2] + bd.B[2]} · ${bd.A[3] + bd.B[3]}</div>`;
      } else {
        extra = `<div class="stats-detail-extra">Goles totales: ${scoreA + scoreB}</div>`;
      }
      return `
        <button type="button" class="stats-detail-row" data-open-share="${escapeHtml(m.id)}">
          <div class="stats-detail-row__meta">
            <span class="stats-detail-date">${escapeHtml(m.date)}</span>
            <span class="stats-detail-place" title="${escapeHtml(m.place || '')}">${escapeHtml(m.place || 'Sin lugar')}</span>
          </div>
          <div class="stats-detail-teams">
            <span class="stats-detail-name">${escapeHtml(m.teamA)}</span>
            <span class="stats-detail-score"><strong>${scoreA}</strong><span class="stats-detail-sep">—</span><strong>${scoreB}</strong></span>
            <span class="stats-detail-name">${escapeHtml(m.teamB)}</span>
          </div>
          <div class="stats-detail-final">Final · ${escapeHtml(formatEndedAt(m.endedAt))}</div>
          ${extra}
        </button>`;
    })
    .join('');
  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-back-stats>← Estadísticas</button>
    </div>
    <h1>${label} · detalle</h1>
    <p class="msg">${list.length} partido${list.length === 1 ? '' : 's'} finalizado${list.length === 1 ? '' : 's'}. Toca uno para ver el resumen y compartir.</p>
    <div class="stack stats-detail-list">${rows}</div>
  `;
}

function bindStatsBySport() {
  const app = document.getElementById('app');
  const back = app.querySelector('[data-back-stats]');
  if (back) back.onclick = () => navigate('stats');
  app.querySelectorAll('[data-open-share]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-open-share');
      const m = getMatch(id);
      if (m && m.status === 'finished') navigate('share', id);
    });
  });
}

function viewSettings() {
  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-back>← Inicio</button>
    </div>
    <h1>Configuración</h1>
    <p class="msg">Equipos reutilizables y copias de seguridad. Todo se guarda en este dispositivo.</p>
    <div class="stack">
      <div class="card settings-block">
        <h2>Equipos guardados</h2>
        <p class="settings-lead">Define nombre, color e imagen una vez y elígelos al crear cada partido.</p>
        <button type="button" class="btn btn-primary btn-block" data-go-teams>Gestionar equipos</button>
      </div>
      <div class="card settings-block">
        <h2>Copia de seguridad (JSON)</h2>
        <p class="settings-lead">Exporta o importa <strong>partidos</strong>, <strong>equipos guardados</strong> e imágenes (Base64 en el archivo). Al importar, solo se <strong>añaden</strong> entradas nuevas (por ID); no se borra nada ni se mezclan equipos ya existentes.</p>
        <button type="button" class="btn btn-primary btn-block" data-export-json>Exportar todo</button>
        <label class="btn btn-block import-json-label">
          Importar JSON
          <input type="file" id="import-json-input" accept=".json,application/json" />
        </label>
      </div>
    </div>
  `;
}

function bindSettings() {
  const app = document.getElementById('app');
  app.querySelector('[data-back]').onclick = () => navigate('home');
  app.querySelector('[data-go-teams]').onclick = () => navigate('teams');

  app.querySelector('[data-export-json]').onclick = () => {
    try {
      const payload = buildExportPayload();
      const json = JSON.stringify(payload, null, 2);
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      downloadJsonFile(`gamecounter-respaldo-${stamp}.json`, json);
      showToast('Archivo generado. Guárdalo en un lugar seguro.', { variant: 'success' });
    } catch (err) {
      showToast(err.message || 'No se pudo exportar', { variant: 'error' });
    }
  };

  const fileInput = app.querySelector('#import-json-input');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      showToast('El archivo es demasiado grande (máx. 40 MB).', { variant: 'error' });
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch {
      showToast('No se pudo leer el archivo.', { variant: 'error' });
      return;
    }
    const ok = await showConfirm(
      'Solo se añadirán al dispositivo los partidos y equipos cuyo identificador (ID) no exista ya aquí. Lo que tengas guardado no se borra. Si un ID coincide con uno local, esa entrada del archivo se omite (no se mezcla ni sobrescribe).',
      {
        title: '¿Importar desde JSON?',
        confirmText: 'Importar',
        cancelText: 'Cancelar',
        danger: false
      }
    );
    if (!ok) return;
    try {
      const data = JSON.parse(text);
      const r = applyImportPayload(data);
      const parts = [];
      if (r.addedMatches > 0) parts.push(`${r.addedMatches} partido${r.addedMatches === 1 ? '' : 's'} nuevos`);
      if (r.skippedMatches > 0) parts.push(`${r.skippedMatches} partido${r.skippedMatches === 1 ? '' : 's'} omitidos (ID ya existía)`);
      if (r.addedTeams > 0) parts.push(`${r.addedTeams} equipo${r.addedTeams === 1 ? '' : 's'} nuevos`);
      if (r.skippedTeams > 0) parts.push(`${r.skippedTeams} equipo${r.skippedTeams === 1 ? '' : 's'} omitidos (ID ya existía)`);
      const summary = parts.length ? parts.join(' · ') : 'Nada nuevo que añadir (todos los IDs ya existían).';
      showToast(summary, { variant: 'success' });
      render();
    } catch (err) {
      showToast(err.message || 'Archivo no válido', { variant: 'error' });
    }
  });
}

function viewTeams() {
  const teams = loadSavedTeams();
  const rows = teams
    .map((t) => {
      return `
        <div class="team-lib-row card">
          <div class="team-lib-row__main">
            <div class="team-badge-slot team-lib-badge" data-team-lib-preview="${String(t.id).replace(/"/g, '')}" style="width:56px;height:56px;"></div>
            <div class="team-lib-row__text">
              <strong class="team-lib-name">${escapeHtml(t.name)}</strong>
              <span class="team-lib-color">${escapeHtml(t.color)}</span>
            </div>
          </div>
          <div class="team-lib-row__actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-team="${escapeHtml(t.id)}">Editar</button>
            <button type="button" class="btn btn-ghost btn-sm" data-delete-team="${escapeHtml(t.id)}">Eliminar</button>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div class="topbar">
      <button type="button" class="btn btn-ghost back" data-back-settings>← Configuración</button>
    </div>
    <h1>Equipos guardados</h1>
    <p class="msg">Estos equipos aparecen al crear un partido. Las imágenes se incluyen en exportación JSON.</p>
    <form class="card team-lib-form" id="form-team-lib">
      <input type="hidden" id="teamLibEditId" value="" />
      <h2 id="teamLibFormTitle">Nuevo equipo</h2>
      <div>
        <label for="teamLibName">Nombre</label>
        <input id="teamLibName" name="name" required maxlength="80" autocomplete="off" placeholder="Nombre del equipo" />
      </div>
      <div style="margin-top:12px;">
        <label for="teamLibColor">Color</label>
        <input type="color" id="teamLibColor" name="color" value="${DEFAULT_COLOR_A}" />
      </div>
      <div style="margin-top:12px;">
        <label for="teamLibFile">Escudo o camiseta (opcional)</label>
        <input type="file" id="teamLibFile" accept="image/*" />
      </div>
      <div class="preview-row">
        <div class="team-badge-slot" style="width:72px;height:72px;" id="teamLibPreviewSlot"></div>
        <button type="button" class="btn btn-ghost" id="teamLibClearImg" style="min-height:44px;">Quitar imagen</button>
      </div>
      <div class="team-lib-form-actions">
        <button type="submit" class="btn btn-primary" id="teamLibSubmit">Guardar equipo</button>
        <button type="button" class="btn btn-ghost" id="teamLibCancelEdit" hidden>Cancelar edición</button>
      </div>
    </form>
    <h2 class="team-lib-list-title">Tu plantilla</h2>
    ${
      teams.length === 0
        ? '<p class="msg">Aún no hay equipos. Usa el formulario de arriba.</p>'
        : `<div class="stack team-lib-list">${rows}</div>`
    }
  `;
}

function bindTeams() {
  const app = document.getElementById('app');
  let pendingImage = null;

  function fakeMatchForPreview(name, color, image) {
    return {
      teamA: name || 'Equipo',
      teamB: '.',
      teamAColor: color || DEFAULT_COLOR_A,
      teamBColor: '#000000',
      teamAImage: image,
      teamBImage: null
    };
  }

  function refreshLibPreview() {
    const name = app.querySelector('#teamLibName')?.value || 'Equipo';
    const color = app.querySelector('#teamLibColor')?.value || DEFAULT_COLOR_A;
    const slot = app.querySelector('#teamLibPreviewSlot');
    if (slot) attachTeamBadgeSlot(slot, fakeMatchForPreview(name, color, pendingImage), 'A');
  }

  app.querySelector('[data-back-settings]').onclick = () => navigate('settings');

  loadSavedTeams().forEach((t) => {
    const slot = app.querySelector('[data-team-lib-preview="' + t.id + '"]');
    if (slot) {
      attachTeamBadgeSlot(
        slot,
        {
          teamA: t.name,
          teamB: '',
          teamAColor: t.color,
          teamBColor: '#000000',
          teamAImage: t.image,
          teamBImage: null
        },
        'A'
      );
    }
  });

  function resetForm() {
    pendingImage = null;
    app.querySelector('#teamLibEditId').value = '';
    app.querySelector('#teamLibName').value = '';
    app.querySelector('#teamLibColor').value = DEFAULT_COLOR_A;
    app.querySelector('#teamLibFile').value = '';
    app.querySelector('#teamLibFormTitle').textContent = 'Nuevo equipo';
    app.querySelector('#teamLibSubmit').textContent = 'Guardar equipo';
    app.querySelector('#teamLibCancelEdit').hidden = true;
    refreshLibPreview();
  }

  app.querySelector('#teamLibFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      pendingImage = await fileToResizedJpegDataUrl(f);
      refreshLibPreview();
    } catch (err) {
      showToast(err.message || 'No se pudo cargar la imagen', { variant: 'error' });
      e.target.value = '';
    }
  });

  app.querySelector('#teamLibClearImg').onclick = () => {
    pendingImage = null;
    app.querySelector('#teamLibFile').value = '';
    refreshLibPreview();
  };

  ['#teamLibName', '#teamLibColor'].forEach((sel) => {
    app.querySelector(sel).addEventListener('input', refreshLibPreview);
  });

  app.querySelector('#form-team-lib').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = String(app.querySelector('#teamLibName').value || '').trim();
    let color = String(app.querySelector('#teamLibColor').value || '').trim();
    if (!name) return;
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) color = DEFAULT_COLOR_A;
    const editId = app.querySelector('#teamLibEditId').value;
    const img = pendingImage && isSafeDataImageUrl(pendingImage) ? pendingImage : null;
    const team = {
      id: editId || newId(),
      name,
      color,
      image: img
    };
    saveSavedTeam(team);
    showToast(editId ? 'Equipo actualizado' : 'Equipo guardado', { variant: 'success' });
    render();
  });

  app.querySelector('#teamLibCancelEdit').onclick = () => resetForm();

  app.querySelectorAll('[data-edit-team]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-team');
      const t = getSavedTeam(id);
      if (!t) return;
      pendingImage = t.image && isSafeDataImageUrl(t.image) ? t.image : null;
      app.querySelector('#teamLibEditId').value = t.id;
      app.querySelector('#teamLibName').value = t.name;
      app.querySelector('#teamLibColor').value = t.color;
      app.querySelector('#teamLibFile').value = '';
      app.querySelector('#teamLibFormTitle').textContent = 'Editar equipo';
      app.querySelector('#teamLibSubmit').textContent = 'Guardar cambios';
      app.querySelector('#teamLibCancelEdit').hidden = false;
      refreshLibPreview();
      app.querySelector('#teamLibName').focus();
    });
  });

  app.querySelectorAll('[data-delete-team]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-team');
      const t = getSavedTeam(id);
      if (!t) return;
      const ok = await showConfirm(`Se eliminará «${t.name}» de la plantilla. Los partidos ya jugados no se borran.`, {
        title: '¿Eliminar equipo?',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        danger: true
      });
      if (!ok) return;
      deleteSavedTeam(id);
      showToast('Equipo eliminado', { variant: 'success' });
      render();
    });
  });

  refreshLibPreview();
}

window.addEventListener('hashchange', render);
render();
