import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  DEFAULT_MUSIC_SETTINGS,
  getToolSettings,
  listMusicFavorites,
  musicFileUrl,
  setMusicFavorite,
  type MusicSettings,
} from "@safespace/api-client";
import { useAuth } from "../auth";
import { deviceOwnerFor } from "../auth/roleRouting";
import type { Playlist, Track } from "./catalog";
import { MusicEngine } from "./engine";
import {
  START_LEVEL,
  clampSeek,
  cycleRepeat as nextRepeat,
  makeQueue,
  nextPos,
  outputLevel,
  prevPos,
  setShuffle as shuffleQueue,
  sleepEndsAt,
  sleepPhase,
  volumeCeiling,
  type Queue,
  type Repeat,
} from "./player";

// The music player (role-flow 9a-9c). It sits above the pages, so music keeps
// playing while someone moves around the app, and stops when they sign out.
// Nothing plays until play is tapped. For a child it follows their
// caregiver's controls: music on or off, a lower volume ceiling, and a sleep
// timer with every play. Favorites are kept on the person's account; nothing
// about listening is recorded.

export interface NowPlaying {
  playlist: Playlist;
  track: Track;
  // Position in the play order, and how many tracks it has.
  pos: number;
  count: number;
  playing: boolean;
  elapsed: number;
  shuffle: boolean;
  repeat: Repeat;
}

interface MusicPlayer {
  supported: boolean;
  isChild: boolean;
  // A child's music turned off by their caregiver.
  musicOff: boolean;
  controls: MusicSettings;
  nowPlaying: NowPlaying | null;
  // A song that couldn't play (shown, then cleared on the next play).
  problem: string | null;
  level: number;
  sleepEndsAt: number | null;
  favorites: ReadonlySet<string>;
  toggleFavorite: (trackId: string) => void;
  playPlaylist: (playlist: Playlist, trackIndex?: number) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setLevel: (level: number) => void;
  setShuffle: (on: boolean) => void;
  cycleRepeat: () => void;
  setSleepTimer: (minutes: number | null) => void;
  stop: () => void;
}

const Ctx = createContext<MusicPlayer | null>(null);

interface Live {
  playlist: Playlist | null;
  queue: Queue | null;
  playing: boolean;
  // Generated sounds and tunes: position = offset + (audio clock - startedAt).
  // Songs report their own position.
  offset: number;
  startedAt: number;
  // Set after the playlist ends: the next play starts the track afresh.
  needsStart: boolean;
  level: number;
  sleepEndsAt: number | null;
  sleepFading: boolean;
  problem: string | null;
}

const fresh = (level: number): Live => ({
  playlist: null, queue: null, playing: false, offset: 0, startedAt: 0, needsStart: false, level,
  sleepEndsAt: null, sleepFading: false, problem: null,
});

export const MusicPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const owner = deviceOwnerFor(session);
  const isChild = session?.kind === "child";
  const engine = useRef<MusicEngine | null>(null);
  if (!engine.current) engine.current = new MusicEngine(musicFileUrl);
  const live = useRef<Live>(fresh(START_LEVEL));
  const [, setTick] = useState(0);
  const render = useCallback(() => setTick((n) => n + 1), []);
  const [controls, setControls] = useState<MusicSettings>(DEFAULT_MUSIC_SETTINGS);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const ceiling = volumeCeiling(isChild, controls.volumeMax);
  const out = useCallback((level: number) => outputLevel(level, ceiling), [ceiling]);
  const elapsed = () => {
    const l = live.current;
    // A song that's loaded knows where it is; anything else goes by the clock.
    const current = l.queue ? trackAt(l, l.queue.pos) : null;
    const song = engine.current!.songPosition;
    if (current?.source.kind === "file" && !l.needsStart && song !== null) return song;
    return l.playing ? l.offset + (engine.current!.clock - l.startedAt) : l.offset;
  };
  const trackAt = (l: Live, pos: number) => (l.playlist && l.queue ? l.playlist.tracks[l.queue.order[pos]] : null);

  const startAt = useCallback(async (pos: number, offset = 0) => {
    const l = live.current;
    const track = trackAt(l, pos);
    if (!track || !l.queue) return;
    l.queue = { ...l.queue, pos };
    l.offset = offset;
    l.needsStart = false;
    l.problem = null;
    const ok = await engine.current!.play(track, l.sleepFading ? 0 : out(l.level), offset);
    l.startedAt = engine.current!.clock;
    l.playing = ok;
    render();
  }, [out, render]);

  // The end of the playlist with repeat off: back to the first track, paused.
  const finish = useCallback(async () => {
    const l = live.current;
    await engine.current!.pause();
    l.playing = false;
    l.offset = 0;
    l.needsStart = true;
    if (l.queue) l.queue = { ...l.queue, pos: 0 };
    render();
  }, [render]);

  const pause = useCallback(async () => {
    const l = live.current;
    if (!l.playing) return;
    l.offset = elapsed();
    l.playing = false;
    render();
    await engine.current!.pause();
  }, [render]);

  const stop = useCallback(() => {
    live.current = fresh(live.current.level);
    engine.current!.close();
    render();
  }, [render]);

  // Sign-out, or a different person on this device: stop, and load the new
  // person's favorites and (for a child) their caregiver's controls.
  useEffect(() => {
    setFavorites(new Set());
    setControls(DEFAULT_MUSIC_SETTINGS);
    if (!session || !owner) return stop;
    let alive = true;
    listMusicFavorites(session).then((ids) => alive && setFavorites(new Set(ids))).catch(() => undefined);
    if (session.kind === "child") {
      getToolSettings(session).then((s) => alive && setControls(s.music)).catch(() => undefined);
    }
    return () => {
      alive = false;
      stop();
    };
    // The session object changes on token refresh; the person is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, stop]);

  // Music turned off for a child while it's playing: stop.
  useEffect(() => {
    if (isChild && !controls.enabled) stop();
  }, [isChild, controls.enabled, stop]);

  // The clock: move on when a track ends (or a song can't play), and run the
  // sleep timer.
  useEffect(() => {
    const id = setInterval(() => {
      const l = live.current;
      if (!l.playing || !l.queue) return;
      if (l.sleepEndsAt) {
        const phase = sleepPhase(l.sleepEndsAt, Date.now());
        if (phase === "done") {
          l.sleepEndsAt = null;
          l.sleepFading = false;
          pause().then(() => engine.current!.setLevel(out(l.level)));
          return;
        }
        if (phase === "fading" && !l.sleepFading) {
          l.sleepFading = true;
          engine.current!.fadeOut((l.sleepEndsAt - Date.now()) / 1000);
        }
      }
      const track = trackAt(l, l.queue.pos);
      const failed = engine.current!.songFailed;
      if (failed) l.problem = `"${track?.title}" couldn't play. Moving on.`;
      if (track && (failed || engine.current!.songEnded || elapsed() >= track.durationSec)) {
        const pos = nextPos(l.queue, failed ? "skip" : "ended");
        if (pos === null || (failed && pos === l.queue.pos)) finish();
        else startAt(pos).then(() => {
          if (failed) live.current.problem = `"${track.title}" couldn't play. Moving on.`;
        });
        return;
      }
      render();
    }, 500);
    return () => clearInterval(id);
  }, [finish, out, pause, render, startAt]);

  // Built on every render so nowPlaying is current.
  const api: MusicPlayer = (() => {
    const l = live.current;
    const queue = l.queue;
    const track = queue ? trackAt(l, queue.pos) : null;
    const musicOff = isChild && !controls.enabled;
    return {
      supported: engine.current!.supported,
      isChild,
      musicOff,
      controls,
      problem: l.problem,
      level: l.level,
      sleepEndsAt: l.sleepEndsAt,
      favorites,
      toggleFavorite: (trackId) => {
        if (!session) return;
        const on = !favorites.has(trackId);
        const nextSet = new Set(favorites);
        if (on) nextSet.add(trackId);
        else nextSet.delete(trackId);
        setFavorites(nextSet);
        // Shown at once; put back if it didn't save.
        setMusicFavorite(session, trackId, on).catch(() => setFavorites(favorites));
      },
      nowPlaying: l.playlist && queue && track
        ? { playlist: l.playlist, track, pos: queue.pos, count: queue.order.length, playing: l.playing, elapsed: Math.min(elapsed(), track.durationSec), shuffle: queue.shuffle, repeat: queue.repeat }
        : null,
      playPlaylist: (playlist, trackIndex = 0) => {
        if (musicOff || playlist.tracks.length === 0) return;
        const c = live.current;
        const prev = c.queue;
        c.playlist = playlist;
        c.queue = makeQueue(playlist.id, playlist.tracks.length, trackIndex, { shuffle: prev?.shuffle, repeat: prev?.repeat });
        // A child's caregiver may want a sleep timer with every play.
        if (isChild && controls.sleepMinutes && !c.sleepEndsAt) c.sleepEndsAt = sleepEndsAt(controls.sleepMinutes, Date.now());
        startAt(c.queue.pos);
      },
      togglePlay: () => {
        const c = live.current;
        if (!c.queue) return;
        if (c.playing) {
          pause();
        } else if (c.needsStart) {
          if (isChild && controls.sleepMinutes && !c.sleepEndsAt) c.sleepEndsAt = sleepEndsAt(controls.sleepMinutes, Date.now());
          startAt(c.queue.pos, c.offset);
        } else {
          c.startedAt = engine.current!.clock;
          c.playing = true;
          render();
          engine.current!.resume().then(() => {
            // The clock was still while paused; count from where it is now.
            live.current.startedAt = engine.current!.clock;
          });
        }
      },
      next: () => {
        const c = live.current;
        if (!c.queue) return;
        const pos = nextPos(c.queue, "skip");
        if (pos === null) finish();
        else startAt(pos);
      },
      prev: () => {
        const c = live.current;
        if (!c.queue) return;
        const { pos, restart } = prevPos(c.queue, elapsed());
        const kind = trackAt(c, pos)?.source.kind;
        if (restart && !c.needsStart && kind === "generated") {
          c.offset = 0;
          c.startedAt = engine.current!.clock;
          render();
        } else if (restart && !c.needsStart && kind === "file") {
          engine.current!.seekSong(0);
          render();
        } else {
          startAt(pos);
        }
      },
      seek: (sec) => {
        const c = live.current;
        const t = c.queue ? trackAt(c, c.queue.pos) : null;
        if (!t) return;
        const to = clampSeek(sec, t.durationSec - 1);
        if (t.source.kind === "file" && !c.needsStart) {
          engine.current!.seekSong(to);
          c.offset = to;
          return render();
        }
        if (t.source.kind !== "generated") {
          // A tune (or a song not loaded yet) starts from the new place;
          // paused, it waits for play.
          if (c.playing) return void startAt(c.queue!.pos, to);
          c.offset = to;
          c.needsStart = true;
          return render();
        }
        // Generated sounds don't depend on where they are, so seeking only
        // moves the position.
        c.offset = to;
        c.startedAt = engine.current!.clock;
        render();
      },
      setLevel: (level) => {
        const c = live.current;
        c.level = level;
        if (!c.sleepFading) engine.current!.setLevel(out(level));
        render();
      },
      setShuffle: (on) => {
        const c = live.current;
        if (c.queue) c.queue = shuffleQueue(c.queue, on);
        render();
      },
      cycleRepeat: () => {
        const c = live.current;
        if (c.queue) c.queue = { ...c.queue, repeat: nextRepeat(c.queue.repeat) };
        render();
      },
      setSleepTimer: (minutes) => {
        const c = live.current;
        c.sleepEndsAt = minutes ? sleepEndsAt(minutes, Date.now()) : null;
        if (c.sleepFading) {
          c.sleepFading = false;
          engine.current!.setLevel(out(c.level));
        }
        render();
      },
      stop,
    };
  })();

  // The phone's lock screen and headphone buttons (where the browser offers
  // them): play, pause, back and next.
  const apiRef = useRef(api);
  apiRef.current = api;
  const np = api.nowPlaying;
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms || typeof MediaMetadata === "undefined") return;
    if (!np) {
      ms.metadata = null;
      return;
    }
    const artist = np.track.source.kind === "file" ? np.track.source.credit.artist : "SafeSpace";
    ms.metadata = new MediaMetadata({ title: np.track.title, artist, album: np.playlist.title });
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => !apiRef.current.nowPlaying?.playing && apiRef.current.togglePlay()],
      ["pause", () => apiRef.current.nowPlaying?.playing && apiRef.current.togglePlay()],
      ["previoustrack", () => apiRef.current.prev()],
      ["nexttrack", () => apiRef.current.next()],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        // Not every browser supports every action.
      }
    }
  }, [np?.track.id, np?.playlist.id, !!np]);
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (ms) ms.playbackState = np ? (np.playing ? "playing" : "paused") : "none";
  }, [np?.playing, !!np]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
};

export function useMusicPlayer(): MusicPlayer {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMusicPlayer must be used inside MusicPlayerProvider");
  return v;
}
