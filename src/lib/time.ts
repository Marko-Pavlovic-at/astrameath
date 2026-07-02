/** 5400 → "1h 30m"; sub-minute durations round down to "0m". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Live timer readout: 4530 → "1:15:30". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function elapsedSeconds(startedAtIso: string): number {
  return (Date.now() - new Date(startedAtIso).getTime()) / 1000;
}

/** Timer sessions longer than this are discarded on stop (forgotten timers). */
export const MAX_SESSION_SECONDS = 12 * 60 * 60;
