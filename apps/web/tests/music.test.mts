/**
 * Music (role-flow 9a): the playlists, the rhymes, the play order, shuffle and repeat,
 * back and next, the children's volume ceiling, the sleep timer and the
 * looping noise. Run with: tsx apps/web/tests/music.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  FAVORITES_ID,
  MOODS,
  PLAYLISTS,
  favoritesPlaylist,
  findPlaylist,
  findTrack,
  hostedTracks,
  playlistsFor,
  songProblems,
  type Track,
} from "../src/features/music/catalog.ts";
import { SOUNDS, fillNoise } from "../src/features/music/ambience.ts";
import { RHYMES, findRhyme, lineAt, parseNotes, rhymeTimeline, rhymeWords } from "../src/features/music/rhymes.ts";
import {
  CHILD_VOLUME_CEILING,
  REPEAT_LABELS,
  SLEEP_MINUTES,
  clampSeek,
  currentTrackIndex,
  cycleRepeat,
  formatTime,
  makeQueue,
  nextPos,
  outputLevel,
  volumeCeiling,
  prevPos,
  setShuffle,
  sleepEndsAt,
  sleepLeftText,
  sleepPhase,
} from "../src/features/music/player.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

// A repeatable "random" for shuffles.
const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test("five playlists, one for each mood, with sounds the browser can make", () => {
  assert.deepEqual(PLAYLISTS.map((p) => p.title), ["Sleepy Stars", "Ocean Calm", "Happy Beats", "Focus Galaxy", "Rhyme Time"]);
  assert.deepEqual(PLAYLISTS.map((p) => p.mood).sort(), MOODS.map((m) => m.key).sort());
  const ids = new Set<string>();
  for (const p of PLAYLISTS) {
    assert.ok(p.tracks.length >= 3, `${p.title} has at least three tracks`);
    for (const t of p.tracks) {
      assert.ok(!ids.has(t.id), `track ids are unique (${t.id})`);
      ids.add(t.id);
      if (t.source.kind === "generated") {
        assert.ok(t.durationSec >= 60 && t.durationSec <= 30 * 60, `${t.title} plays 1 to 30 minutes`);
        assert.equal(typeof SOUNDS[t.source.sound], "function", `${t.title} has a sound`);
      } else {
        const rhyme = findRhyme(t.source.rhymeId);
        assert.ok(rhyme, `${t.title} is a rhyme we have`);
        assert.ok(t.durationSec >= rhymeTimeline(rhyme!).totalSec, `${t.title} plays its whole tune`);
      }
    }
  }
});

test("rhymes: English, Hindi and Telugu, every rhyme in Rhyme Time", () => {
  for (const lang of ["en", "hi", "te"] as const) {
    assert.ok(RHYMES.filter((r) => r.lang === lang).length >= 2, `at least two ${lang} rhymes`);
  }
  const rhymeTime = PLAYLISTS.find((p) => p.id === "rhyme-time")!;
  assert.deepEqual(
    rhymeTime.tracks.map((t) => (t.source.kind === "rhyme" ? t.source.rhymeId : "")),
    RHYMES.map((r) => r.id),
  );
  assert.equal(new Set(RHYMES.map((r) => r.id)).size, RHYMES.length);
});

test("rhymes: every line has a tune, Hindi and Telugu lines have English letters too", () => {
  for (const r of RHYMES) {
    assert.ok(r.lines.length >= 3, `${r.title} has its lines`);
    for (const line of r.lines) {
      assert.ok(line.text.trim(), `${r.title}: no empty lines`);
      assert.ok(parseNotes(line.notes).some((n) => n.midi !== null), `${r.title}: "${line.text}" has notes`);
      if (r.lang !== "en") assert.ok(line.roman?.trim(), `${r.title}: "${line.text}" has its English-letter line`);
    }
    const t = rhymeTimeline(r);
    assert.ok(t.totalSec >= 10 && t.totalSec <= 90, `${r.title} lasts 10 to 90 seconds (${t.totalSec.toFixed(1)})`);
    for (const n of t.notes) assert.ok(n.midi >= 55 && n.midi <= 74, `${r.title}: notes stay in a singing range`);
    assert.equal(rhymeWords(r).split("\n").length, r.lines.length);
  }
});

test("notes: names, sharps, flats, rests and lengths", () => {
  assert.deepEqual(parseNotes("C4 A4:2 F#4:0.5 Bb3 R:1.5"), [
    { midi: 60, beats: 1 },
    { midi: 69, beats: 2 },
    { midi: 66, beats: 0.5 },
    { midi: 58, beats: 1 },
    { midi: null, beats: 1.5 },
  ]);
  assert.throws(() => parseNotes("H4"));
  assert.throws(() => parseNotes("C4:0"));
});

test("sing-along: the lit line follows the tune and stays on through each pause", () => {
  const twinkle = rhymeTimeline(findRhyme("twinkle-twinkle")!);
  const beat = 60 / 96;
  assert.equal(twinkle.lines.length, 6);
  assert.equal(twinkle.lines[0].end, 8 * beat);
  assert.equal(twinkle.lines[1].start, 8.5 * beat);
  assert.equal(lineAt(twinkle, -1), -1);
  assert.equal(lineAt(twinkle, 0), 0);
  assert.equal(lineAt(twinkle, 8.2 * beat), 0);
  assert.equal(lineAt(twinkle, 8.5 * beat), 1);
  assert.equal(lineAt(twinkle, twinkle.totalSec + 5), 5);
});

test("filtering by mood, and finding a playlist by its address", () => {
  assert.equal(playlistsFor("all").length, 5);
  assert.deepEqual(playlistsFor("sing").map((p) => p.id), ["rhyme-time"]);
  assert.deepEqual(playlistsFor("focus").map((p) => p.id), ["focus-galaxy"]);
  assert.equal(findPlaylist("ocean-calm")?.title, "Ocean Calm");
  assert.equal(findPlaylist("nope"), null);
  assert.equal(findPlaylist(undefined), null);
});

test("in order: next goes along, and the end stops unless repeat is on", () => {
  const q = makeQueue("p", 3, 1);
  assert.deepEqual([q.order, q.pos, currentTrackIndex(q)], [[0, 1, 2], 1, 1]);
  assert.equal(nextPos(q, "skip"), 2);
  const last = { ...q, pos: 2 };
  assert.equal(nextPos(last, "ended"), null);
  assert.equal(nextPos(last, "skip"), null);
  assert.equal(nextPos({ ...last, repeat: "all" }, "ended"), 0);
});

test("repeat one replays the track when it ends, but next still moves on", () => {
  const q = { ...makeQueue("p", 3, 0), repeat: "one" as const };
  assert.equal(nextPos(q, "ended"), 0);
  assert.equal(nextPos(q, "skip"), 1);
  assert.equal(nextPos({ ...q, pos: 2 }, "skip"), 0);
  assert.deepEqual([cycleRepeat("off"), cycleRepeat("all"), cycleRepeat("one")], ["all", "one", "off"]);
  assert.equal(Object.keys(REPEAT_LABELS).length, 3);
});

test("back restarts after a few seconds, otherwise goes to the one before", () => {
  const q = makeQueue("p", 3, 1);
  assert.deepEqual(prevPos(q, 10), { pos: 1, restart: true });
  assert.deepEqual(prevPos(q, 1), { pos: 0, restart: false });
  const first = makeQueue("p", 3, 0);
  assert.deepEqual(prevPos(first, 1), { pos: 0, restart: true });
  assert.deepEqual(prevPos({ ...first, repeat: "all" }, 1), { pos: 2, restart: false });
});

test("shuffle plays the chosen track first, every track once, and keeps it when toggled", () => {
  const q = makeQueue("p", 6, 4, { shuffle: true }, seeded());
  assert.equal(q.pos, 0);
  assert.equal(currentTrackIndex(q), 4);
  assert.deepEqual([...q.order].sort(), [0, 1, 2, 3, 4, 5]);
  const moved = { ...q, pos: 3 };
  const playing = currentTrackIndex(moved);
  const off = setShuffle(moved, false);
  assert.deepEqual(off.order, [0, 1, 2, 3, 4, 5]);
  assert.equal(currentTrackIndex(off), playing);
  const on = setShuffle(off, true, seeded(3));
  assert.equal(currentTrackIndex(on), playing);
  assert.equal(setShuffle(on, true), on);
});

test("a start outside the playlist is pulled back in", () => {
  assert.equal(makeQueue("p", 3, 9).pos, 2);
  assert.equal(makeQueue("p", 3, -2).pos, 0);
});

test("children's volume is capped (a caregiver can lower it); nobody goes past full", () => {
  const child = volumeCeiling(true);
  assert.equal(child, CHILD_VOLUME_CEILING);
  assert.ok(CHILD_VOLUME_CEILING <= 0.6);
  assert.equal(outputLevel(1, child), CHILD_VOLUME_CEILING);
  assert.equal(outputLevel(0.5, child), 0.5 * CHILD_VOLUME_CEILING);
  assert.equal(volumeCeiling(true, 30), 0.3);
  assert.equal(volumeCeiling(true, 90), CHILD_VOLUME_CEILING, "never above 60%, whatever is saved");
  assert.equal(volumeCeiling(true, 2), 0.1, "never so low it can't be heard");
  assert.equal(volumeCeiling(false, 30), 1, "adults have no ceiling");
  assert.equal(outputLevel(1, 1), 1);
  assert.equal(outputLevel(3, 1), 1);
  assert.equal(outputLevel(-1, child), 0);
  assert.equal(outputLevel(Number.NaN, 1), 0.5);
});

test("sleep timer: 10, 20 or 30 minutes, fading over the last 30 seconds", () => {
  assert.deepEqual([...SLEEP_MINUTES], [10, 20, 30]);
  const now = 1_000_000;
  const end = sleepEndsAt(10, now);
  assert.equal(end - now, 600_000);
  assert.equal(sleepPhase(end, now), "running");
  assert.equal(sleepPhase(end, end - 31_000), "running");
  assert.equal(sleepPhase(end, end - 30_000), "fading");
  assert.equal(sleepPhase(end, end), "done");
  assert.equal(sleepLeftText(end, now), "10 min");
  assert.equal(sleepLeftText(end, end - 20_000), "under a minute");
});

test("times read as m:ss (or h:mm:ss), and seeking stays inside the track", () => {
  assert.deepEqual([formatTime(0), formatTime(65), formatTime(600), formatTime(3750), formatTime(-4)], ["0:00", "1:05", "10:00", "1:02:30", "0:00"]);
  assert.equal(clampSeek(-5, 100), 0);
  assert.equal(clampSeek(150, 100), 100);
  assert.equal(clampSeek(Number.NaN, 100), 0);
});

test("noise loops without a click and never goes past 0.9", () => {
  for (const color of ["white", "pink", "brown"] as const) {
    const n = fillNoise(color, 48_000, seeded(11));
    let peak = 0;
    for (const v of n) peak = Math.max(peak, Math.abs(v));
    assert.ok(Math.abs(peak - 0.9) < 1e-6, `${color} peaks at 0.9`);
    // Brown noise moves slowly, so a jump at the loop point would click: the
    // step from the end back to the start is no bigger than any step inside.
    if (color === "brown") {
      let maxStep = 0;
      for (let i = 1; i < n.length; i++) maxStep = Math.max(maxStep, Math.abs(n[i] - n[i - 1]));
      assert.ok(Math.abs(n[n.length - 1] - n[0]) <= maxStep, "brown noise joins up at the loop");
    }
  }
});

test("favorites: hearted tracks from any playlist, newest first, gone ones left out", () => {
  const mine = favoritesPlaylist(["rhyme-twinkle-twinkle", "no-longer-here", "gentle-waves"]);
  assert.equal(mine.id, FAVORITES_ID);
  assert.equal(mine.mood, "mine");
  assert.deepEqual(mine.tracks.map((t) => t.id), ["rhyme-twinkle-twinkle", "gentle-waves"]);
  assert.equal(favoritesPlaylist([]).tracks.length, 0);
  assert.equal(findTrack("gentle-waves")?.playlist.id, "ocean-calm");
  assert.equal(findTrack("nope"), null);
  assert.ok(!PLAYLISTS.some((p) => p.id === FAVORITES_ID || p.id === "credits"), "no playlist hides the favorites or credits pages");
});

test("track ids fit what the database accepts for favorites", () => {
  for (const t of PLAYLISTS.flatMap((p) => p.tracks)) assert.match(t.id, /^[a-z0-9][a-z0-9-]{0,79}$/);
});

test("hosted songs: every one has its file, maker, source and an allowed licence", () => {
  for (const t of hostedTracks()) assert.deepEqual(songProblems(t), [], t.title);
  const song = (licence: string, path = "rhymes/twinkle.mp3"): Track => ({
    id: "song-twinkle", title: "Twinkle", durationSec: 95,
    source: { kind: "file", path, sung: true, credit: { artist: "A Singer", sourceUrl: "https://example.org/t", licence, licenceUrl: "https://creativecommons.org/licenses/by/4.0/" } },
  });
  assert.deepEqual(songProblems(song("CC BY 4.0")), []);
  assert.deepEqual(songProblems(song("CC0 1.0")), []);
  assert.deepEqual(songProblems(song("Paid licence (Some Shop)")), []);
  assert.equal(songProblems(song("CC BY-NC 4.0")).length, 1, "non-commercial licences need a decision first");
  assert.equal(songProblems(song("CC BY 4.0", "Twinkle Final.MP3")).length, 1);
  assert.deepEqual(songProblems(PLAYLISTS[0].tracks[0]), [], "generated sounds need no credit");
});

console.log(`${passed} music checks`);
