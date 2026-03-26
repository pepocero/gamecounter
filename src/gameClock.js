/** Reloj de juego pausable (estado persistido en el partido). */

export function createInitialClock() {
  return { elapsedMs: 0, runningSince: null };
}

/**
 * Normaliza el reloj en el mismo objeto (referencia del partido).
 * Si no hay objeto válido, devuelve uno nuevo (el llamador debe asignarlo a `match.clock`).
 */
export function ensureClock(clock) {
  if (!clock || typeof clock !== 'object') {
    return createInitialClock();
  }
  if (typeof clock.elapsedMs !== 'number' || !Number.isFinite(clock.elapsedMs) || clock.elapsedMs < 0) {
    clock.elapsedMs = 0;
  }
  if (
    clock.runningSince != null &&
    (typeof clock.runningSince !== 'number' || !Number.isFinite(clock.runningSince))
  ) {
    clock.runningSince = null;
  }
  return clock;
}

export function isClockRunning(clock) {
  const c = ensureClock(clock);
  return c.runningSince != null;
}

/** True si el reloj está en 00:00 y parado. */
export function isClockAtZeroStopped(clock) {
  const c = ensureClock(clock);
  return c.runningSince == null && c.elapsedMs === 0;
}

export function getElapsedMs(clock) {
  const c = ensureClock(clock);
  let ms = c.elapsedMs;
  if (c.runningSince != null) {
    ms += Date.now() - c.runningSince;
  }
  return ms;
}

export function startClock(clock) {
  const c = ensureClock(clock);
  if (c.runningSince != null) return c;
  c.runningSince = Date.now();
  return c;
}

export function pauseClock(clock) {
  const c = ensureClock(clock);
  if (c.runningSince == null) return c;
  c.elapsedMs += Date.now() - c.runningSince;
  c.runningSince = null;
  return c;
}

/** Pone el reloj en 00:00 parado (mismo objeto si existe). */
export function resetClock(clock) {
  const c = clock && typeof clock === 'object' ? clock : createInitialClock();
  c.elapsedMs = 0;
  c.runningSince = null;
  return c;
}

export function formatClockMs(ms) {
  const n = Math.max(0, Math.floor(Number(ms) || 0));
  const totalSec = Math.floor(n / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${mm}:${ss}`;
}
