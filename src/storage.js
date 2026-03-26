const STORAGE_KEY = 'gamecounter_matches_v1';
const TEAMS_KEY = 'gamecounter_saved_teams_v1';

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function loadMatches() {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return safeParse(raw, []);
}

function persist(matches) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
}

export function saveMatch(match) {
  const list = loadMatches();
  const i = list.findIndex((m) => m.id === match.id);
  if (i >= 0) list[i] = match;
  else list.unshift(match);
  persist(list);
  return match;
}

export function getMatch(id) {
  return loadMatches().find((m) => m.id === id) ?? null;
}

export function deleteMatch(id) {
  const list = loadMatches().filter((m) => m.id !== id);
  persist(list);
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/** Equipos guardados para reutilizar en nuevos partidos */
export function loadSavedTeams() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function persistSavedTeams(teams) {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
}

export function saveSavedTeam(team) {
  const list = loadSavedTeams();
  const i = list.findIndex((t) => t.id === team.id);
  if (i >= 0) list[i] = team;
  else list.unshift(team);
  persistSavedTeams(list);
  return team;
}

export function deleteSavedTeam(id) {
  const list = loadSavedTeams().filter((t) => t.id !== id);
  persistSavedTeams(list);
}

export function getSavedTeam(id) {
  return loadSavedTeams().find((t) => t.id === id) ?? null;
}

function isValidHexColor(c) {
  return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);
}

function validateSavedTeamRaw(t) {
  if (!t || typeof t !== 'object') return false;
  if (typeof t.id !== 'string' || !t.id.trim()) return false;
  if (typeof t.name !== 'string' || !String(t.name).trim()) return false;
  if (!isValidHexColor(t.color)) return false;
  if (t.image != null) {
    if (typeof t.image !== 'string' || !t.image.startsWith('data:image/')) return false;
    if (t.image.length > 3_000_000) return false;
  }
  return true;
}

function validateMatchRaw(m) {
  if (!m || typeof m !== 'object') return false;
  if (typeof m.id !== 'string') return false;
  if (m.sport !== 'soccer' && m.sport !== 'basketball') return false;
  if (typeof m.teamA !== 'string' || typeof m.teamB !== 'string') return false;
  if (!Array.isArray(m.events)) return false;
  if (m.status !== 'live' && m.status !== 'finished' && m.status !== 'scheduled') return false;
  return true;
}

/**
 * Exporta todo el estado de la app. Las imágenes van como data URLs dentro del JSON.
 */
export function buildExportPayload() {
  return {
    version: 1,
    app: 'gamecounter',
    exportedAt: new Date().toISOString(),
    matches: loadMatches(),
    savedTeams: loadSavedTeams()
  };
}

/**
 * Importación aditiva: solo añade partidos y equipos cuyo `id` no exista ya en el dispositivo.
 * No borra nada ni fusiona ni sobrescribe registros existentes (mismo id = se omite).
 */
export function applyImportPayload(data) {
  if (!data || typeof data !== 'object') throw new Error('El archivo no es un objeto JSON válido.');
  if (data.version !== 1) throw new Error('Versión de archivo no compatible.');
  if (!Array.isArray(data.matches)) throw new Error('Falta el array de partidos.');
  if (!Array.isArray(data.savedTeams)) throw new Error('Falta el array de equipos guardados.');

  const matches = loadMatches();
  const teams = loadSavedTeams();
  const matchIds = new Set(matches.map((m) => m.id));
  const teamIds = new Set(teams.map((t) => t.id));

  let addedMatches = 0;
  let skippedMatches = 0;
  let addedTeams = 0;
  let skippedTeams = 0;

  for (const m of data.matches) {
    if (!validateMatchRaw(m)) throw new Error('Hay partidos con formato inválido.');
    if (matchIds.has(m.id)) {
      skippedMatches += 1;
      continue;
    }
    matches.push(m);
    matchIds.add(m.id);
    addedMatches += 1;
  }

  for (const t of data.savedTeams) {
    if (!validateSavedTeamRaw(t)) throw new Error('Hay equipos guardados con formato inválido.');
    if (teamIds.has(t.id)) {
      skippedTeams += 1;
      continue;
    }
    teams.push(t);
    teamIds.add(t.id);
    addedTeams += 1;
  }

  persist(matches);
  persistSavedTeams(teams);

  return { addedMatches, skippedMatches, addedTeams, skippedTeams };
}

export function computeScores(match) {
  let a = 0;
  let b = 0;
  for (const ev of match.events || []) {
    if (ev.team === 'A') a += ev.points;
    else if (ev.team === 'B') b += ev.points;
  }
  return { scoreA: a, scoreB: b };
}

/** Quita el último evento de ese equipo con esa cantidad de puntos (para corregir errores). */
export function removeLastScoringEvent(matchId, team, points) {
  const cur = getMatch(matchId);
  if (!cur || cur.status !== 'live') return false;
  if (team !== 'A' && team !== 'B') return false;
  const ev = cur.events || [];
  for (let i = ev.length - 1; i >= 0; i--) {
    if (ev[i].team === team && ev[i].points === points) {
      ev.splice(i, 1);
      saveMatch(cur);
      return true;
    }
  }
  return false;
}

export function basketballBreakdown(events) {
  const byTeam = { A: { 1: 0, 2: 0, 3: 0 }, B: { 1: 0, 2: 0, 3: 0 } };
  for (const ev of events || []) {
    if (ev.team !== 'A' && ev.team !== 'B') continue;
    const p = ev.points;
    if (p === 1 || p === 2 || p === 3) byTeam[ev.team][p] += 1;
  }
  return byTeam;
}

export function aggregateStats(matches) {
  const finished = matches.filter((m) => m.status === 'finished');
  let totalSoccer = 0;
  let totalBasket = 0;
  let goalsSoccer = 0;
  let pointsBasket = 0;
  const teamWins = {};
  for (const m of finished) {
    const { scoreA, scoreB } = computeScores(m);
    if (m.sport === 'soccer') {
      totalSoccer += 1;
      goalsSoccer += scoreA + scoreB;
    } else if (m.sport === 'basketball') {
      totalBasket += 1;
      pointsBasket += scoreA + scoreB;
    }
    if (scoreA > scoreB) {
      const name = m.teamA || 'Equipo A';
      teamWins[name] = (teamWins[name] || 0) + 1;
    } else if (scoreB > scoreA) {
      const name = m.teamB || 'Equipo B';
      teamWins[name] = (teamWins[name] || 0) + 1;
    }
  }
  return {
    totalMatches: finished.length,
    totalSoccer,
    totalBasket,
    goalsSoccer,
    pointsBasket,
    teamWins
  };
}
