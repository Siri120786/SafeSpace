import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FAVORITES_ID,
  MOODS,
  SOFT_SYMPHONY,
  favoritesPlaylist,
  findPlaylist,
  findTrack,
  hostedTracks,
  moodLabel,
  playlistMinutes,
  playlistsFor,
  type Mood,
  type Playlist,
  type Track,
} from "./catalog";
import { useMusicPlayer } from "./MusicPlayerContext";
import { REPEAT_LABELS, SLEEP_MINUTES, formatTime, sleepLeftText } from "./player";
import { RHYME_LANG_LABELS, findRhyme, lineAt, rhymeTimeline, rhymeWords, type Rhyme } from "./rhymes";
import { LANG_TAGS, ReadAloudButton, hasVoiceFor } from "../speech";

// The music screens (role-flow 9a/9b): the library, one playlist with the
// full controls, favorites, the credits, and the mini-player at the bottom of
// every page. Big buttons with
// words, everything works from the keyboard, and nothing moves on its own.

export type MusicTone = "child" | "adult";

export const musicPath = (base: string, playlistId?: string) => (playlistId ? `${base}/${playlistId}` : base);

// ---- Icons ----------------------------------------------------------------

const Svg: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 24 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">{children}</svg>
);
const PlayIcon = ({ size }: { size?: number }) => <Svg size={size}><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></Svg>;
const PauseIcon = ({ size }: { size?: number }) => <Svg size={size}><rect x="6" y="5" width="4.5" height="14" rx="1.2" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.2" /></Svg>;
const PrevIcon = ({ size }: { size?: number }) => <Svg size={size}><rect x="5" y="5" width="2.6" height="14" rx="1" /><path d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9.2 13.2a1.4 1.4 0 0 1 0-2.4l8.25-5.43A1 1 0 0 1 19 6.2Z" /></Svg>;
const NextIcon = ({ size }: { size?: number }) => <Svg size={size}><rect x="16.4" y="5" width="2.6" height="14" rx="1" /><path d="M5 6.2v11.6a1 1 0 0 0 1.55.83l8.25-5.43a1.4 1.4 0 0 0 0-2.4L6.55 5.37A1 1 0 0 0 5 6.2Z" /></Svg>;

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-botanical-700 focus-visible:ring-offset-2";

// ---- Library --------------------------------------------------------------

export const CREDITS_PATH = "credits";

// The featured soft symphony: one tap plays it (then Sleepy Stars carries on).
const FeaturedSymphony: React.FC<{ tone: MusicTone }> = ({ tone }) => {
  const player = useMusicPlayer();
  const found = findTrack(SOFT_SYMPHONY.id);
  if (!found) return null;
  const isCurrent = player.nowPlaying?.track.id === SOFT_SYMPHONY.id;
  const playing = isCurrent && player.nowPlaying?.playing;
  return (
    <section
      aria-labelledby="featured-symphony"
      className="flex items-center gap-4 rounded-3xl p-5 text-charcoal shadow-card"
      style={{ background: "linear-gradient(135deg, #E9E3F6, #F6EFE8)" }}
    >
      <span aria-hidden="true" className="text-5xl">🎻</span>
      <span className="flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-botanical-800">Featured</span>
        <span id="featured-symphony" className={`block font-display ${tone === "child" ? "text-xl font-bold" : "text-lg font-medium"}`}>
          Soft symphony
        </span>
        <span className="block text-sm text-charcoal/75">A gentle orchestra for winding down. About 9 minutes.</span>
      </span>
      <button
        type="button"
        onClick={() => (isCurrent ? player.togglePlay() : player.playPlaylist(found.playlist, found.playlist.tracks.indexOf(found.track)))}
        aria-label={playing ? "Pause the soft symphony" : "Play the soft symphony"}
        className={`grid h-12 w-12 flex-none place-items-center rounded-full bg-botanical-700 text-white ${focusRing}`}
      >
        <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
      </button>
    </section>
  );
};

export const MusicLibrary: React.FC<{ base: string; tone: MusicTone }> = ({ base, tone }) => {
  const [mood, setMood] = useState<Mood | "all">("all");
  const { supported, musicOff, favorites } = useMusicPlayer();
  if (musicOff) return <MusicOffNote />;
  const mine = favoritesPlaylist(favorites);
  const lists = [...(mood === "all" && mine.tracks.length > 0 ? [mine] : []), ...playlistsFor(mood)];
  return (
    <div className="space-y-5">
      {!supported && <NoAudioNote />}
      <FeaturedSymphony tone={tone} />
      <div role="group" aria-label="Show playlists for" className="flex flex-wrap gap-2">
        {[{ key: "all" as const, label: "All" }, ...MOODS].map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={mood === m.key}
            onClick={() => setMood(m.key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${focusRing} ${
              mood === m.key ? "border-botanical-700 bg-botanical-700 text-white" : "border-botanical-200 bg-white text-botanical-800"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {lists.map((p) => (
          <li key={p.id}>
            <Link
              to={musicPath(base, p.id)}
              style={{ background: `linear-gradient(135deg, ${p.colors.from}, ${p.colors.to})` }}
              className={`flex items-center gap-4 rounded-3xl p-5 text-charcoal shadow-card ${focusRing}`}
            >
              <span aria-hidden="true" className="text-5xl">{p.emoji}</span>
              <span>
                <span className={`block font-display ${tone === "child" ? "text-xl font-bold" : "text-lg font-medium"}`}>{p.title}</span>
                <span className="block text-sm text-charcoal/75">{p.blurb}</span>
                <span className="mt-1 block text-xs font-semibold text-botanical-800">{playlistSummary(p)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-charcoal/60">
        Most sounds and tunes are made right here on your device. Nothing plays until you press play.{" "}
        <Link to={musicPath(base, CREDITS_PATH)} className="font-semibold text-botanical-800 underline">Music credits</Link>
      </p>
    </div>
  );
};

function playlistSummary(p: Playlist): string {
  const count = `${p.tracks.length} ${p.mood === "sing" ? "rhymes" : p.mood === "mine" ? "hearted" : "sounds"}`;
  if (p.mood === "mine") return count;
  return `${moodLabel(p.mood)} · ${MOODS.find((m) => m.key === p.mood)?.when} · ${count}`;
}

const NoAudioNote = () => (
  <p role="status" className="rounded-2xl bg-white px-4 py-3 text-sm text-charcoal">
    This browser can't play the sounds. Try another browser, like Chrome or Edge.
  </p>
);

// A child whose caregiver has turned music off.
const MusicOffNote = () => (
  <p className="rounded-3xl bg-white p-5 text-charcoal shadow-card">
    Music is turned off for now. Ask your grown-up if you'd like it back on.
  </p>
);

// The playlist for an address: a library playlist, or the person's favorites.
export function usePlaylist(id: string | undefined): Playlist | null {
  const { favorites } = useMusicPlayer();
  if (id === FAVORITES_ID) return favoritesPlaylist(favorites);
  return findPlaylist(id);
}

// ---- One playlist ---------------------------------------------------------

export const PlaylistView: React.FC<{ playlist: Playlist; tone: MusicTone }> = ({ playlist, tone }) => {
  const player = useMusicPlayer();
  if (player.musicOff) return <MusicOffNote />;
  const np = player.nowPlaying?.playlist.id === playlist.id ? player.nowPlaying : null;
  const empty = playlist.tracks.length === 0;
  return (
    <div className="space-y-5">
      {!player.supported && <NoAudioNote />}
      <section
        style={{ background: `linear-gradient(135deg, ${playlist.colors.from}, ${playlist.colors.to})` }}
        className="rounded-3xl p-5 shadow-card space-y-4"
      >
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="text-6xl">{playlist.emoji}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-botanical-800">{moodLabel(playlist.mood)}</p>
            <h2 className={`font-display text-charcoal ${tone === "child" ? "text-2xl font-bold" : "text-xl font-medium"}`}>{playlist.title}</h2>
            <p className="text-sm text-charcoal/75">
              {playlist.blurb}{empty ? "" : ` About ${playlistMinutes(playlist)} minutes.`}
            </p>
          </div>
        </div>
        {np ? (
          <>
            <FullControls />
            {np.track.source.kind === "rhyme" && <SingAlong rhymeId={np.track.source.rhymeId} elapsed={np.elapsed} />}
          </>
        ) : empty ? (
          <p className="text-sm text-charcoal">Nothing here yet. Tap the heart next to any sound, tune or song to keep it here.</p>
        ) : (
          <button
            type="button"
            disabled={!player.supported}
            onClick={() => player.playPlaylist(playlist, 0)}
            className={`flex items-center gap-2 rounded-full bg-botanical-700 px-6 py-3 text-base font-bold text-white disabled:opacity-50 ${focusRing}`}
          >
            <PlayIcon /> Play {playlist.title}
          </button>
        )}
      </section>

      {!empty && (
        <section aria-label={`What's in ${playlist.title}`} className="rounded-3xl bg-white p-3 shadow-card">
          <ol className="divide-y divide-ivory-200">
            {playlist.tracks.map((t, i) => {
              const isCurrent = np?.track.id === t.id;
              return (
                <li key={t.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!player.supported}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => (isCurrent ? player.togglePlay() : player.playPlaylist(playlist, i))}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3 text-left disabled:opacity-50 ${focusRing} ${isCurrent ? "bg-botanical-50" : ""}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-botanical-100 text-botanical-800">
                      {isCurrent && np?.playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-charcoal">{t.title}</span>
                      <TrackTag track={t} />
                      {isCurrent && <span className="block text-xs text-botanical-800">{np?.playing ? "Playing now" : "Paused"}</span>}
                    </span>
                    <span className="text-sm text-charcoal/60">{formatTime(t.durationSec)}</span>
                  </button>
                  <HeartButton track={t} />
                </li>
              );
            })}
          </ol>
          <p className="px-3 pb-2 pt-3 text-xs text-charcoal/60">
            {playlist.mood === "sing"
              ? "Traditional rhymes, played as gentle tunes. Sing along with the words!"
              : playlist.mood === "mine"
                ? "Tap a heart again to take it off this list."
                : "More songs are coming soon."}
          </p>
        </section>
      )}
    </div>
  );
};

// The small line under a track's name: a rhyme's language, or a song's singer.
const TrackTag: React.FC<{ track: Track }> = ({ track }) => {
  if (track.source.kind === "rhyme") return <RhymeTag rhymeId={track.source.rhymeId} />;
  if (track.source.kind === "file") {
    return (
      <span className="block text-xs text-charcoal/60">
        {track.source.sung ? "🎤 Sung · " : ""}{track.source.credit.artist}
      </span>
    );
  }
  return null;
};

const HeartButton: React.FC<{ track: Track }> = ({ track }) => {
  const { favorites, toggleFavorite } = useMusicPlayer();
  const on = favorites.has(track.id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Take ${track.title} out of My favorites` : `Add ${track.title} to My favorites`}
      title={on ? "In My favorites" : "Add to My favorites"}
      onClick={() => toggleFavorite(track.id)}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${focusRing}`}
    >
      <span aria-hidden="true">{on ? "💖" : "🤍"}</span>
    </button>
  );
};

// A song that couldn't load (the player has already moved on).
const ProblemNote: React.FC = () => {
  const { problem } = useMusicPlayer();
  return problem ? <span role="status" className="block text-xs text-red-700">{problem}</span> : null;
};

// ---- Credits ----------------------------------------------------------------

export const MusicCredits: React.FC = () => {
  const songs = hostedTracks().filter((t) => t.source.credit.showOnCredits !== false);
  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-3xl bg-white p-5 shadow-card text-sm text-charcoal">
        <h2 className="font-display text-lg font-bold">Made by SafeSpace</h2>
        <p>
          The calm sounds and the rhyme tunes are made by SafeSpace, right on your device. The rhymes are traditional
          English, Hindi and Telugu rhymes, which belong to everyone.
        </p>
      </section>
      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-card text-sm text-charcoal">
        <h2 className="font-display text-lg font-bold">Songs</h2>
        {songs.length === 0 ? (
          <p>No songs yet. Each song added will be listed here with who made it and its licence.</p>
        ) : (
          <ul className="space-y-3">
            {songs.map((t) => (
              <li key={t.id}>
                <p className="font-semibold">{t.title}</p>
                <p className="text-charcoal/75">
                  {t.source.credit.attribution ?? `by ${t.source.credit.artist}`} ·{" "}
                  <a href={t.source.credit.licenceUrl} target="_blank" rel="noreferrer" className="underline">{t.source.credit.licence}</a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

// ---- Rhymes ---------------------------------------------------------------

const RhymeTag: React.FC<{ rhymeId: string }> = ({ rhymeId }) => {
  const r = findRhyme(rhymeId);
  if (!r) return null;
  const roman = r.lang === "en" ? null : r.lines[0]?.roman?.replace(/[,.?!।]+$/, "");
  return (
    <span className="block text-xs text-charcoal/60">
      {RHYME_LANG_LABELS[r.lang]}{roman ? ` · ${roman}` : ""}
    </span>
  );
};

// The words, with the line being sung lit up. The light moves line by line,
// with no animation.
const SingAlong: React.FC<{ rhymeId: string; elapsed: number }> = ({ rhymeId, elapsed }) => {
  const rhyme = findRhyme(rhymeId);
  if (!rhyme) return null;
  return <SingAlongWords rhyme={rhyme} elapsed={elapsed} />;
};

const SingAlongWords: React.FC<{ rhyme: Rhyme; elapsed: number }> = ({ rhyme, elapsed }) => {
  const current = lineAt(rhymeTimeline(rhyme), elapsed);
  const tag = LANG_TAGS[rhyme.lang];
  return (
    <section aria-label={`Words for ${rhyme.title}`} lang={tag} className="space-y-2 rounded-3xl bg-white/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-botanical-800">🎤 Sing along · {RHYME_LANG_LABELS[rhyme.lang]}</p>
        {hasVoiceFor(tag) && <ReadAloudButton text={rhymeWords(rhyme)} lang={tag} label={`Say the words of ${rhyme.title}`} />}
      </div>
      <ol className="space-y-1">
        {rhyme.lines.map((line, i) => (
          <li
            key={i}
            aria-current={i === current ? "true" : undefined}
            className={`rounded-2xl px-3 py-1.5 ${i === current ? "bg-mascotPink-soft font-bold text-charcoal" : "text-charcoal/75"}`}
          >
            <span className="block text-lg leading-snug">{line.text}</span>
            {line.roman && <span lang="en" className="block text-xs text-charcoal/60">{line.roman}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
};

// ---- Controls -------------------------------------------------------------

const RoundButton: React.FC<{ label: string; onClick: () => void; big?: boolean; children: React.ReactNode }> = ({ label, onClick, big, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`flex shrink-0 items-center justify-center rounded-full ${focusRing} ${
      big ? "h-16 w-16 bg-botanical-700 text-white" : "h-12 w-12 bg-white text-botanical-800 border border-botanical-200"
    }`}
  >
    {children}
  </button>
);

const SeekBar: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { nowPlaying: np, seek } = useMusicPlayer();
  if (!np) return null;
  const total = np.track.durationSec;
  return (
    <div className="flex items-center gap-2 text-xs text-charcoal/70">
      <span className="w-12 text-right tabular-nums">{formatTime(np.elapsed)}</span>
      <input
        type="range"
        min={0}
        max={total}
        step={1}
        value={Math.floor(np.elapsed)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label={`Position in ${np.track.title}`}
        aria-valuetext={`${formatTime(np.elapsed)} of ${formatTime(total)}`}
        className={`flex-1 p-0 accent-botanical-700 ${compact ? "h-4" : "h-6"}`}
      />
      <span className="w-12 tabular-nums">{formatTime(total)}</span>
    </div>
  );
};

const VolumeSlider: React.FC = () => {
  const { level, setLevel, isChild } = useMusicPlayer();
  const pct = Math.round(level * 100);
  return (
    <label className="mt-0 flex items-center gap-2 text-sm font-semibold text-botanical-800">
      <span aria-hidden="true">🔉</span>
      <span className="sr-only">Volume</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        onChange={(e) => setLevel(Number(e.target.value) / 100)}
        aria-valuetext={`${pct}%${isChild ? ", kept gentle" : ""}`}
        className="w-28 p-0 h-6 accent-botanical-700"
      />
      <span className="w-10 tabular-nums text-xs text-charcoal/70">{pct}%</span>
    </label>
  );
};

const MainButtons: React.FC<{ big?: boolean }> = ({ big }) => {
  const { nowPlaying: np, togglePlay, next, prev } = useMusicPlayer();
  if (!np) return null;
  return (
    <div className="flex items-center gap-2">
      <RoundButton label="Back" onClick={prev}><PrevIcon size={big ? 24 : 20} /></RoundButton>
      <RoundButton label={np.playing ? "Pause" : "Play"} onClick={togglePlay} big>
        {np.playing ? <PauseIcon size={30} /> : <PlayIcon size={30} />}
      </RoundButton>
      <RoundButton label="Next" onClick={next}><NextIcon size={big ? 24 : 20} /></RoundButton>
    </div>
  );
};

const FullControls: React.FC = () => {
  const p = useMusicPlayer();
  const np = p.nowPlaying!;
  const toggle = "rounded-full border px-4 py-2 text-sm font-semibold";
  const on = "border-botanical-700 bg-botanical-700 text-white";
  const off = "border-botanical-200 bg-white text-botanical-800";
  return (
    <div className="space-y-4 rounded-3xl bg-white/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-lg font-bold text-charcoal" aria-live="polite">
          {np.playing ? "Playing" : "Paused"}: {np.track.title}
        </p>
        <HeartButton track={np.track} />
      </div>
      <ProblemNote />
      <SeekBar />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MainButtons big />
        <VolumeSlider />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={np.shuffle} onClick={() => p.setShuffle(!np.shuffle)} className={`${toggle} ${focusRing} ${np.shuffle ? on : off}`}>
          🔀 Shuffle {np.shuffle ? "on" : "off"}
        </button>
        <button type="button" onClick={p.cycleRepeat} className={`${toggle} ${focusRing} ${np.repeat === "off" ? off : on}`}>
          {np.repeat === "one" ? "🔂" : "🔁"} {REPEAT_LABELS[np.repeat]}
        </button>
      </div>
      <div role="group" aria-label="Sleep timer" className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-botanical-800">🌙 Sleep timer</span>
        <button type="button" aria-pressed={!p.sleepEndsAt} onClick={() => p.setSleepTimer(null)} className={`${toggle} ${focusRing} ${!p.sleepEndsAt ? on : off}`}>
          Off
        </button>
        {SLEEP_MINUTES.map((m) => (
          <button key={m} type="button" onClick={() => p.setSleepTimer(m)} className={`${toggle} ${focusRing} ${off}`}>
            {m} min
          </button>
        ))}
        {p.sleepEndsAt && (
          <span role="status" className="text-sm text-charcoal/75">
            Stops gently in {sleepLeftText(p.sleepEndsAt, Date.now())}
          </span>
        )}
      </div>
    </div>
  );
};

// ---- Mini-player ----------------------------------------------------------

// At the bottom of every page while something is loaded, except on that
// playlist's own page (which has the full controls). `basePath` is where the
// playlist pages are for this person; `raised` lifts it above a bottom bar.
export const MiniPlayer: React.FC<{ basePath: string | null; raised?: boolean }> = ({ basePath, raised }) => {
  const { nowPlaying: np, stop } = useMusicPlayer();
  const { pathname } = useLocation();
  if (!np || !basePath) return null;
  const playlistPage = musicPath(basePath, np.playlist.id);
  if (pathname === playlistPage) return null;
  return (
    <>
      <div aria-hidden="true" className="h-40" />
      <section
        aria-label="Music player"
        className={`fixed inset-x-0 z-40 mx-auto max-w-2xl px-3 ${raised ? "bottom-28" : "bottom-3"}`}
      >
        <div className="space-y-2 rounded-3xl border border-botanical-200 bg-white px-4 py-3 shadow-pill">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl">{np.playlist.emoji}</span>
            <Link to={playlistPage} className={`min-w-0 flex-1 rounded-xl ${focusRing}`}>
              <span className="block truncate font-semibold text-charcoal">{np.track.title}</span>
              <span className="block truncate text-xs text-botanical-800">
                {np.playlist.title} · {np.playing ? "Playing" : "Paused"}
              </span>
              <ProblemNote />
            </Link>
            <div className="hidden sm:block"><MainButtons /></div>
            <button
              type="button"
              aria-label="Close the music player"
              title="Close"
              onClick={stop}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-charcoal/60 ${focusRing}`}
            >
              ✕
            </button>
          </div>
          {/* On a phone the buttons get their own row, so the title has room. */}
          <div className="flex justify-center sm:hidden"><MainButtons /></div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="min-w-[12rem] flex-1"><SeekBar compact /></div>
            <VolumeSlider />
          </div>
        </div>
      </section>
    </>
  );
};
