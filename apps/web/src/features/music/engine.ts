// The audio side of the player (role-flow 9a/9b): one AudioContext, made on
// the first tap of play (browsers only allow sound after a tap, which is also
// our rule), a volume stage and a limiter so nothing can come out loud.
// Generated sounds and rhyme tunes are made in the context; hosted songs play
// from an <audio> element routed through the same volume and limiter.

import { SOUNDS, rhymeSound, type Sound } from "./ambience";
import { findRhyme } from "./rhymes";
import type { Track } from "./catalog";
import { FADE_IN_SEC, PAUSE_FADE_SEC } from "./player";

type Ctx = AudioContext;

// What to play for a generated sound or a rhyme's tune (from where it's up to).
function soundFor(track: Track, offsetSec: number): Sound | null {
  if (track.source.kind === "generated") return SOUNDS[track.source.sound];
  if (track.source.kind === "rhyme") {
    const rhyme = findRhyme(track.source.rhymeId);
    return rhyme ? rhymeSound(rhyme, offsetSec) : null;
  }
  return null;
}

function newContext(): Ctx | null {
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return C ? new C() : null;
}

export class MusicEngine {
  // fileUrl turns a hosted song's path into its link.
  constructor(private readonly fileUrl: (path: string) => string) {}

  private ctx: Ctx | null = null;
  // The hosted song playing, if any.
  private media: HTMLAudioElement | null = null;
  private mediaFailed = false;
  private volume: GainNode | null = null;
  private current: { bus: GainNode; stop: () => void } | null = null;
  private level = 0;
  // play, pause, resume and close run one after another, so a quick
  // pause-then-play can't leave the sound suspended.
  private pending: Promise<unknown> = Promise.resolve();

  private serial<T>(op: () => Promise<T>): Promise<T> {
    const run = this.pending.then(op, op);
    this.pending = run.catch(() => undefined);
    return run;
  }

  // False on browsers without Web Audio.
  get supported(): boolean {
    return typeof window !== "undefined" && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  // The audio clock in seconds. It stands still while paused.
  get clock(): number {
    return this.ctx?.currentTime ?? 0;
  }

  // Where a hosted song is up to (null for generated sounds and tunes, which
  // go by the clock).
  get songPosition(): number | null {
    return this.media ? this.media.currentTime : null;
  }

  // True once a hosted song has played to its end, or couldn't load.
  get songEnded(): boolean {
    return !!this.media?.ended;
  }
  get songFailed(): boolean {
    return this.mediaFailed;
  }

  // Move a hosted song to `sec` (generated sounds don't need this).
  seekSong(sec: number) {
    if (this.media) this.media.currentTime = sec;
  }

  private ensure(): Ctx | null {
    if (this.ctx) return this.ctx;
    const ctx = newContext();
    if (!ctx) return null;
    const volume = ctx.createGain();
    volume.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    volume.connect(limiter);
    limiter.connect(ctx.destination);
    this.ctx = ctx;
    this.volume = volume;
    return ctx;
  }

  private rampTo(value: number, seconds: number) {
    if (!this.ctx || !this.volume) return;
    const g = this.volume.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(value, now + Math.max(0.01, seconds));
  }

  // Start a track from silence and fade it in. Must be called from a tap.
  play(track: Track, level: number, offsetSec = 0): Promise<boolean> {
    // Made here, not in the queue, so it happens inside the tap.
    this.ensure();
    return this.serial(() => this.playNow(track, level, offsetSec));
  }

  private async playNow(track: Track, level: number, offsetSec: number): Promise<boolean> {
    const ctx = this.ensure();
    const sound = track.source.kind === "file" ? this.songSound(this.fileUrl(track.source.path), offsetSec) : soundFor(track, offsetSec);
    if (!ctx || !this.volume || !sound) return false;
    if (this.current && ctx.state === "running") {
      // A quick fade so changing tracks doesn't click.
      this.rampTo(0, PAUSE_FADE_SEC);
      await new Promise((r) => setTimeout(r, PAUSE_FADE_SEC * 1000 + 30));
    }
    this.stopSound();
    if (ctx.state === "suspended") await ctx.resume();
    this.volume.gain.cancelScheduledValues(ctx.currentTime);
    this.volume.gain.setValueAtTime(0, ctx.currentTime);
    const bus = ctx.createGain();
    bus.connect(this.volume);
    const stop = sound(ctx, bus);
    this.current = { bus, stop };
    this.level = level;
    this.rampTo(level, FADE_IN_SEC);
    return true;
  }

  // A hosted song as a sound: an <audio> element feeding the bus. It needs
  // the file's CORS headers (Supabase Storage sends them), or the browser
  // would play silence through Web Audio.
  private songSound(url: string, offsetSec: number): Sound {
    return (ctx, bus) => {
      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      el.src = url;
      if (offsetSec > 0) el.currentTime = offsetSec;
      const node = (ctx as AudioContext).createMediaElementSource(el);
      node.connect(bus);
      this.media = el;
      this.mediaFailed = false;
      el.addEventListener("error", () => {
        if (this.media === el) this.mediaFailed = true;
      });
      el.play().catch(() => {
        if (this.media === el) this.mediaFailed = true;
      });
      return () => {
        el.pause();
        node.disconnect();
        el.removeAttribute("src");
        el.load();
        if (this.media === el) this.media = null;
      };
    };
  }

  pause(): Promise<void> {
    return this.serial(() => this.pauseNow());
  }

  private async pauseNow(): Promise<void> {
    if (!this.ctx || this.ctx.state !== "running") return;
    this.rampTo(0, PAUSE_FADE_SEC);
    await new Promise((r) => setTimeout(r, PAUSE_FADE_SEC * 1000 + 30));
    // A song keeps going on its own unless it's paused too.
    this.media?.pause();
    await this.ctx.suspend();
  }

  resume(): Promise<void> {
    return this.serial(async () => {
      if (!this.ctx) return;
      await this.ctx.resume();
      await this.media?.play().catch(() => {
        this.mediaFailed = true;
      });
      this.rampTo(this.level, FADE_IN_SEC / 2);
    });
  }

  setLevel(level: number) {
    this.level = level;
    this.rampTo(level, 0.15);
  }

  // Fade out over `seconds` (the sleep timer); the level comes back on resume.
  fadeOut(seconds: number) {
    this.rampTo(0, seconds);
  }

  private stopSound() {
    if (!this.current) return;
    const { bus, stop } = this.current;
    this.current = null;
    stop();
    bus.disconnect();
  }

  // Stop and let the sound card go. Used on sign-out and when the player closes.
  close(): Promise<void> {
    return this.serial(async () => {
      this.stopSound();
      const ctx = this.ctx;
      this.ctx = null;
      this.volume = null;
      if (ctx && ctx.state !== "closed") await ctx.close();
    });
  }
}
