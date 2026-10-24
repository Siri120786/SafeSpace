// Browser sound and voice for games. Sounds are synthesised from soundScript.ts
// with Web Audio (no audio files to download); the voice is the browser's own
// speech synthesis. Both stay silent unless the player turned them on, every
// call is safe where the browser has no audio or speech, and nothing starts
// before the player's first tap (browsers require that).
import { effectScript, type Effect, type Note } from "./soundScript";

type AudioCtor = typeof AudioContext;

export class GameAudio {
  soundEnabled = false;
  voiceEnabled = false;
  lang = "en";
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Call from a tap or key press so the browser lets audio start. */
  unlock(): void {
    if (!this.ctx) {
      try {
        const Ctor: AudioCtor | undefined =
          typeof window === "undefined" ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16; // quiet on purpose
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
  }

  /** Plays a list of notes if sound is on. */
  playNotes(notes: Note[]): void {
    if (!this.soundEnabled) return;
    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    try {
      const t0 = ctx.currentTime + 0.01;
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = n.freq;
        const start = t0 + n.at;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.gain), start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
        osc.connect(gain).connect(master);
        osc.start(start);
        osc.stop(start + n.dur + 0.05);
      }
    } catch {
      // Audio is a bonus; never break the game.
    }
  }

  play(effect: Effect): void {
    this.playNotes(effectScript(effect));
  }

  /**
   * Speaks text aloud. `force` is for the player pressing "Read to me";
   * otherwise it only speaks when read-aloud is on. Returns whether it started.
   */
  speak(message: string, force = false): boolean {
    if (!force && !this.voiceEnabled) return false;
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !message.trim()) return false;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(message);
      u.lang = this.lang;
      u.rate = 0.9;
      u.pitch = 1.05;
      u.volume = 0.9;
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(this.lang));
      if (voice) u.voice = voice;
      synth.speak(u);
      return true;
    } catch {
      return false;
    }
  }

  stopSpeaking(): void {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  dispose(): void {
    this.stopSpeaking();
    try {
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
    this.master = null;
  }
}
