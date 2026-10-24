// The player's rules (role-flow 9a): the play order, shuffle, repeat, back
// and next, the volume ceiling and the sleep timer. No React or audio here,
// so apps/web/tests/music.test.mts can check them.

export type Repeat = "off" | "all" | "one";

export interface Queue {
  playlistId: string;
  // Track indexes in the order they play, and where we are in that order.
  order: number[];
  pos: number;
  shuffle: boolean;
  repeat: Repeat;
}

export const REPEAT_LABELS: Record<Repeat, string> = {
  off: "Repeat off",
  all: "Repeat playlist",
  one: "Repeat this one",
};

export const SLEEP_MINUTES = [10, 20, 30] as const;

// Children's volume never goes past 60% of full (a caregiver can set it
// lower, role-flow 9c), and everyone starts at half of their own range.
// Nothing plays until someone taps play.
export const CHILD_VOLUME_CEILING = 0.6;
export const START_LEVEL = 0.5;

// Play fades in; pause, stop and the sleep timer fade out.
export const FADE_IN_SEC = 3;
export const PAUSE_FADE_SEC = 0.25;
export const SLEEP_FADE_SEC = 30;

// "Back" restarts the track when it has played longer than this.
export const RESTART_AFTER_SEC = 3;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function shuffled(items: number[], rng: () => number): number[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The chosen track first when shuffling, then the rest in a random order.
function orderFrom(count: number, start: number, shuffle: boolean, rng: () => number) {
  if (!shuffle) return { order: range(count), pos: start };
  return { order: [start, ...shuffled(range(count).filter((i) => i !== start), rng)], pos: 0 };
}

export function makeQueue(
  playlistId: string,
  trackCount: number,
  startIndex: number,
  opts: { shuffle?: boolean; repeat?: Repeat } = {},
  rng: () => number = Math.random,
): Queue {
  const start = Math.min(Math.max(0, Math.floor(startIndex)), Math.max(0, trackCount - 1));
  const shuffle = opts.shuffle ?? false;
  return { playlistId, ...orderFrom(trackCount, start, shuffle, rng), shuffle, repeat: opts.repeat ?? "off" };
}

export const currentTrackIndex = (q: Queue): number => q.order[q.pos];

// Turning shuffle on or off keeps the track that's playing.
export function setShuffle(q: Queue, on: boolean, rng: () => number = Math.random): Queue {
  if (on === q.shuffle) return q;
  return { ...q, ...orderFrom(q.order.length, currentTrackIndex(q), on, rng), shuffle: on };
}

export function cycleRepeat(r: Repeat): Repeat {
  return r === "off" ? "all" : r === "all" ? "one" : "off";
}

// Where to go when a track ends by itself ("ended") or someone taps next
// ("skip"). null means stop: the end of the playlist with repeat off.
export function nextPos(q: Queue, reason: "ended" | "skip"): number | null {
  if (reason === "ended" && q.repeat === "one") return q.pos;
  if (q.pos + 1 < q.order.length) return q.pos + 1;
  return q.repeat === "off" ? null : 0;
}

// Back: restart the track if it's been playing a while (or it's the first),
// otherwise the one before.
export function prevPos(q: Queue, elapsedSec: number): { pos: number; restart: boolean } {
  if (elapsedSec > RESTART_AFTER_SEC) return { pos: q.pos, restart: true };
  if (q.pos > 0) return { pos: q.pos - 1, restart: false };
  if (q.repeat === "all" && q.order.length > 1) return { pos: q.order.length - 1, restart: false };
  return { pos: q.pos, restart: true };
}

// The loudest a person's music can be (0 to 1): full for adults; for a
// child, their caregiver's setting (percent of full), never above 60%.
export function volumeCeiling(isChild: boolean, volumeMaxPercent: number | null = null): number {
  if (!isChild) return 1;
  const set = volumeMaxPercent === null || !Number.isFinite(volumeMaxPercent) ? 60 : volumeMaxPercent;
  return Math.min(CHILD_VOLUME_CEILING, Math.max(0.1, set / 100));
}

// The slider's level (0 to 1) as the real output level, under the ceiling.
export function outputLevel(level: number, ceiling: number): number {
  const l = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : START_LEVEL;
  return l * Math.min(1, Math.max(0, ceiling));
}

export function clampSeek(sec: number, durationSec: number): number {
  if (!Number.isFinite(sec)) return 0;
  return Math.min(Math.max(0, sec), durationSec);
}

// The sleep timer: playing normally, fading out over the last 30 seconds,
// then done (the player pauses).
export function sleepPhase(endsAtMs: number, nowMs: number): "running" | "fading" | "done" {
  const left = endsAtMs - nowMs;
  if (left <= 0) return "done";
  return left <= SLEEP_FADE_SEC * 1000 ? "fading" : "running";
}

export function sleepEndsAt(minutes: number, nowMs: number): number {
  return nowMs + minutes * 60_000;
}

// "4:05", or "1:02:30" past an hour.
export function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// What's left on the sleep timer, in whole minutes rounded up ("12 min").
export function sleepLeftText(endsAtMs: number, nowMs: number): string {
  const min = Math.max(0, Math.ceil((endsAtMs - nowMs) / 60_000));
  return min <= 1 ? "under a minute" : `${min} min`;
}
