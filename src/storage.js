import { isSafeTeamAudioDataUrl } from './audioUtils.js';
import { isSafeDataImageUrl } from './imageUtils.js';
import {
  isIdbMediaRef,
  collectIdbRefsFromMatch,
  collectIdbRefsFromTeam,
  deleteMediaRefs,
  clearAllMediaBlobs,
  refToDataUrl
} from './mediaStore.js';

const STORAGE_KEY = 'gamecounter_matches_v1';
const TEAMS_KEY = 'gamecounter_saved_teams_v1';

/** localStorage lleno (imágenes/audio en Base64 suelen llenar ~5 MB) */
export class StorageQuotaError extends Error {
  constructor(message = 'Almacenamiento lleno') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

function isQuotaExceeded(e) {
  return (
    e &&
    (e.name === 'QuotaExceededError' ||
      e.code === 22 ||
      e.code === 1014 ||
      (typeof e.message === 'string' && e.message.toLowerCase().includes('quota')))
  );
}

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  } catch (e) {
    if (isQuotaExceeded(e)) throw new StorageQuotaError();
    throw e;
  }
}

export function saveMatch(match) {
  const list = loadMatches();
  const i = list.findIndex((m) => m.id === match.id);
  if (i >= 0) list[i] = match;
  else list.unshift(match);
  persist(list);
  return match;
}

/** Quita multimedia del partido y borra los blobs asociados en IndexedDB. */
export async function slimMatchMedia(match) {
  const refs = collectIdbRefsFromMatch(match);
  await deleteMediaRefs(refs);
  return {
    ...match,
    teamAImage: null,
    teamBImage: null,
    teamAAudio: null,
    teamBAudio: null
  };
}

/**
 * Intenta guardar el partido; si no cabe, reintenta sin escudos ni audio
 * y actualiza el objeto `match` en memoria si hubo que recortar.
 * @returns {{ ok: boolean, slimmed: boolean }}
 */
export async function trySaveMatch(match) {
  try {
    saveMatch(match);
    return { ok: true, slimmed: false };
  } catch (e) {
    if (!(e instanceof StorageQuotaError)) throw e;
    const hadMedia = !!(
      match.teamAImage ||
      match.teamBImage ||
      match.teamAAudio ||
      match.teamBAudio
    );
    if (!hadMedia) return { ok: false, slimmed: false };
    const slim = await slimMatchMedia(match);
    try {
      saveMatch(slim);
      Object.assign(match, slim);
      return { ok: true, slimmed: true };
    } catch (e2) {
      if (e2 instanceof StorageQuotaError) return { ok: false, slimmed: false };
      throw e2;
    }
  }
}

export function getMatch(id) {
  return loadMatches().find((m) => m.id === id) ?? null;
}

export async function deleteMatch(id) {
  const cur = getMatch(id);
  if (cur) await deleteMediaRefs(collectIdbRefsFromMatch(cur));
  const list = loadMatches().filter((m) => m.id !== id);
  persist(list);
}

/** Quita solo partidos finalizados (estadísticas e historial de finalizados). Mantiene programados, en vivo y equipos. */
export async function deleteFinishedMatches() {
  const list = loadMatches();
  const refs = [];
  for (const m of list) {
    if (m.status === 'finished') refs.push(...collectIdbRefsFromMatch(m));
  }
  await deleteMediaRefs(refs);
  persist(list.filter((m) => m.status !== 'finished'));
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
  try {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  } catch (e) {
    if (isQuotaExceeded(e)) throw new StorageQuotaError();
    throw e;
  }
}

export function saveSavedTeam(team) {
  const list = loadSavedTeams();
  const i = list.findIndex((t) => t.id === team.id);
  if (i >= 0) list[i] = team;
  else list.unshift(team);
  persistSavedTeams(list);
  return team;
}

export async function deleteSavedTeam(id) {
  const cur = getSavedTeam(id);
  if (cur) await deleteMediaRefs(collectIdbRefsFromTeam(cur));
  const list = loadSavedTeams().filter((t) => t.id !== id);
  persistSavedTeams(list);
}

export function getSavedTeam(id) {
  return loadSavedTeams().find((t) => t.id === id) ?? null;
}

/**
 * Borra todos los partidos y equipos guardados en este dispositivo (localStorage).
 * También vacía multimedia en IndexedDB y limpia marcas auxiliares en sessionStorage. Irreversible.
 */
export async function clearAllAppData() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TEAMS_KEY);
  } catch {
    /* ignore */
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('gamecounterHighlightUpcoming');
    }
  } catch {
    /* ignore */
  }
  try {
    await clearAllMediaBlobs();
  } catch {
    /* ignore */
  }
}

function isValidHexColor(c) {
  return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);
}

function validatePlayerEntry(p) {
  if (!p || typeof p !== 'object') return false;
  if (typeof p.id !== 'string' || !p.id.trim()) return false;
  if (typeof p.name !== 'string' || !String(p.name).trim()) return false;
  if (String(p.name).length > 120) return false;
  return true;
}

function validateSavedTeamRaw(t) {
  if (!t || typeof t !== 'object') return false;
  if (typeof t.id !== 'string' || !t.id.trim()) return false;
  if (typeof t.name !== 'string' || !String(t.name).trim()) return false;
  if (!isValidHexColor(t.color)) return false;
  if (t.image != null) {
    if (typeof t.image !== 'string') return false;
    if (isSafeDataImageUrl(t.image)) {
      if (t.image.length > 3_000_000) return false;
    } else if (!isIdbMediaRef(t.image)) return false;
  }
  if (t.audio != null) {
    if (typeof t.audio !== 'string') return false;
    if (!isSafeTeamAudioDataUrl(t.audio) && !isIdbMediaRef(t.audio)) return false;
  }
  if (t.players != null) {
    if (!Array.isArray(t.players)) return false;
    if (t.players.length > 50) return false;
    for (const p of t.players) {
      if (!validatePlayerEntry(p)) return false;
    }
  }
  return true;
}

function validateRosterOptional(roster) {
  if (roster == null) return true;
  if (!Array.isArray(roster)) return false;
  if (roster.length > 50) return false;
  for (const p of roster) {
    if (!validatePlayerEntry(p)) return false;
  }
  return true;
}

function validateClockOptional(clock) {
  if (clock == null) return true;
  if (typeof clock !== 'object') return false;
  if (typeof clock.elapsedMs !== 'number' || !Number.isFinite(clock.elapsedMs) || clock.elapsedMs < 0) return false;
  if (clock.runningSince != null) {
    if (typeof clock.runningSince !== 'number' || !Number.isFinite(clock.runningSince)) return false;
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
  if (!validateRosterOptional(m.rosterA)) return false;
  if (!validateRosterOptional(m.rosterB)) return false;
  if (!validateClockOptional(m.clock)) return false;
  if (m.teamAImage != null) {
    if (typeof m.teamAImage !== 'string') return false;
    if (isSafeDataImageUrl(m.teamAImage)) {
      if (m.teamAImage.length > 3_000_000) return false;
    } else if (!isIdbMediaRef(m.teamAImage)) return false;
  }
  if (m.teamBImage != null) {
    if (typeof m.teamBImage !== 'string') return false;
    if (isSafeDataImageUrl(m.teamBImage)) {
      if (m.teamBImage.length > 3_000_000) return false;
    } else if (!isIdbMediaRef(m.teamBImage)) return false;
  }
  if (m.teamAAudio != null) {
    if (typeof m.teamAAudio !== 'string') return false;
    if (!isSafeTeamAudioDataUrl(m.teamAAudio) && !isIdbMediaRef(m.teamAAudio)) return false;
  }
  if (m.teamBAudio != null) {
    if (typeof m.teamBAudio !== 'string') return false;
    if (!isSafeTeamAudioDataUrl(m.teamBAudio) && !isIdbMediaRef(m.teamBAudio)) return false;
  }
  return true;
}

async function resolveMatchForExport(m) {
  const o = { ...m };
  for (const k of ['teamAImage', 'teamBImage', 'teamAAudio', 'teamBAudio']) {
    const v = o[k];
    if (v != null && typeof v === 'string' && isIdbMediaRef(v)) {
      const data = await refToDataUrl(v);
      o[k] = data;
    }
  }
  return o;
}

async function resolveTeamForExport(t) {
  const o = { ...t };
  for (const k of ['image', 'audio']) {
    const v = o[k];
    if (v != null && typeof v === 'string' && isIdbMediaRef(v)) {
      o[k] = await refToDataUrl(v);
    }
  }
  return o;
}

/**
 * Exporta todo el estado de la app. Las referencias IndexedDB se convierten a data URLs en el JSON.
 */
export async function buildExportPayload() {
  const matches = await Promise.all(loadMatches().map((m) => resolveMatchForExport(m)));
  const savedTeams = await Promise.all(loadSavedTeams().map((t) => resolveTeamForExport(t)));
  return {
    version: 1,
    app: 'gamecounter',
    exportedAt: new Date().toISOString(),
    matches,
    savedTeams
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
      const removed = ev.splice(i, 1)[0];
      try {
        saveMatch(cur);
        return true;
      } catch (e) {
        ev.splice(i, 0, removed);
        if (e instanceof StorageQuotaError) return false;
        throw e;
      }
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
