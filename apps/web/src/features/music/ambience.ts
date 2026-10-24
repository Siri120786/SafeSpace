// The sounds made in the browser (role-flow 9a): rain, waves, wind, hums and
// gentle tunes, built from noise and simple tones with the Web Audio API. No
// files, no downloads, no licences. Each sound plays into a "bus" the engine
// gives it and returns a function that stops its timers and sources.
//
// Levels are kept soft (peaks around a third of full) and the engine adds a
// limiter after them, so no sound can jump out loud.

import type { AmbienceKey } from "./catalog";
import { rhymeTimeline, type Rhyme } from "./rhymes";

export type Sound = (ctx: BaseAudioContext, bus: AudioNode) => () => void;

// ---- Noise ----------------------------------------------------------------

export type NoiseColor = "white" | "pink" | "brown";

// Noise samples that loop without a click: the end is blended into the start.
// Peaks are scaled to 0.9. Pure, so the tests can check it.
export function fillNoise(color: NoiseColor, length: number, rng: () => number = Math.random): Float32Array {
  const fade = Math.min(Math.floor(length / 8), 4096);
  const raw = new Float32Array(length + fade);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < raw.length; i++) {
    const w = rng() * 2 - 1;
    if (color === "white") {
      raw[i] = w;
    } else if (color === "pink") {
      // Paul Kellet's pink filter.
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      raw[i] = last;
    }
  }
  const out = raw.slice(0, length);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] = raw[i] * k + raw[length + i] * (1 - k);
  }
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < length; i++) out[i] = (out[i] / peak) * 0.9;
  return out;
}

function noise(ctx: BaseAudioContext, color: NoiseColor, seconds = 12): AudioBufferSourceNode {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  buffer.getChannelData(0).set(fillNoise(color, length));
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

// ---- Small building blocks -------------------------------------------------

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const between = (a: number, b: number) => a + Math.random() * (b - a);

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function chain(...nodes: AudioNode[]): void {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
}

// A slow wobble on a setting (volume, filter), around its current value.
function lfo(ctx: BaseAudioContext, rate: number, depth: number, target: AudioParam): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.frequency.value = rate;
  const amount = gain(ctx, depth);
  chain(osc, amount);
  amount.connect(target);
  osc.start();
  return osc;
}

// Calls `step` with the time of the next event, a few seconds ahead of the
// clock; `step` schedules it and returns when the one after is due. A paused
// (suspended) context stops its clock, so nothing piles up while paused.
function every(ctx: BaseAudioContext, step: (t: number) => number): () => void {
  let next = ctx.currentTime + 0.15;
  const tick = () => {
    while (next < ctx.currentTime + 3) next = step(next);
  };
  tick();
  const id = setInterval(tick, 400);
  return () => clearInterval(id);
}

// One plucked or struck note: a few sine partials with a quick attack and a
// natural decay.
function note(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  opts: { level: number; decay: number; partials: [number, number][] },
): void {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(opts.level, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
  env.connect(out);
  for (const [ratio, amp] of opts.partials) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * ratio;
    const g = gain(ctx, amp);
    chain(osc, g, env);
    osc.start(t);
    osc.stop(t + opts.decay + 0.05);
  }
}

const MUSIC_BOX: [number, number][] = [[1, 1], [2, 0.25], [3, 0.08]];
const MARIMBA: [number, number][] = [[1, 1], [4, 0.18], [10, 0.03]];
const BELL: [number, number][] = [[1, 1], [2.76, 0.18], [5.4, 0.05]];

// A soft held note that swells in and out, for pads and drones.
function pad(ctx: BaseAudioContext, out: AudioNode, freqs: number[], level: number): () => void {
  const stops: OscillatorNode[] = [];
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    osc.detune.value = between(-4, 4);
    const g = gain(ctx, level);
    chain(osc, g, out);
    osc.start();
    stops.push(osc, lfo(ctx, between(0.03, 0.08), level * 0.6, g.gain));
  }
  return () => stops.forEach((o) => o.stop());
}

// A melody that wanders up and down a scale in short phrases and comes home
// to the first note at the end of each one.
function wanderingTune(scale: number[], phrase = 8) {
  let i = 0;
  let count = 0;
  return () => {
    count++;
    if (count % phrase === 0) {
      i = 0;
      return { freq: midi(scale[0]), phraseEnd: true };
    }
    i = Math.min(scale.length - 1, Math.max(0, i + pick([-2, -1, -1, 1, 1, 2])));
    return { freq: midi(scale[i]), phraseEnd: false };
  };
}

// ---- The sounds ------------------------------------------------------------

const softRain: Sound = (ctx, bus) => {
  const src = noise(ctx, "pink");
  const g = gain(ctx, 0.32);
  chain(src, filter(ctx, "highpass", 400), filter(ctx, "lowpass", 6500), g, bus);
  const patter = noise(ctx, "white");
  const pg = gain(ctx, 0.035);
  chain(patter, filter(ctx, "bandpass", 3200, 0.6), pg, bus);
  const wobble = lfo(ctx, 0.11, 0.05, g.gain);
  src.start();
  patter.start();
  return () => [src, patter, wobble].forEach((n) => n.stop());
};

const pinkRain: Sound = (ctx, bus) => {
  const src = noise(ctx, "pink");
  chain(src, filter(ctx, "lowpass", 2800), gain(ctx, 0.36), bus);
  src.start();
  return () => src.stop();
};

const gentleWaves: Sound = (ctx, bus) => {
  const src = noise(ctx, "brown");
  const lp = filter(ctx, "lowpass", 500);
  const g = gain(ctx, 0.05);
  chain(src, lp, g, bus);
  src.start();
  // Each wave rolls in and out over 7 to 11 seconds.
  const stop = every(ctx, (t) => {
    const len = between(7, 11);
    const crest = t + len * 0.4;
    const peak = between(0.35, 0.5);
    g.gain.setValueAtTime(0.05, t);
    g.gain.linearRampToValueAtTime(peak, crest);
    g.gain.linearRampToValueAtTime(0.05, t + len);
    lp.frequency.setValueAtTime(350, t);
    lp.frequency.linearRampToValueAtTime(between(1100, 1500), crest);
    lp.frequency.linearRampToValueAtTime(350, t + len);
    return t + len;
  });
  return () => {
    stop();
    src.stop();
  };
};

const deepSea: Sound = (ctx, bus) => {
  const src = noise(ctx, "brown");
  const g = gain(ctx, 0.45);
  chain(src, filter(ctx, "lowpass", 260), g, bus);
  const swell = lfo(ctx, 0.05, 0.12, g.gain);
  src.start();
  // Now and then, a little bubble rising.
  const bubbles = gain(ctx, 0.05);
  bubbles.connect(bus);
  const stop = every(ctx, (t) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const f = between(280, 520);
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.09);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    chain(osc, env, bubbles);
    osc.start(t);
    osc.stop(t + 0.15);
    return t + between(2.5, 7);
  });
  return () => {
    stop();
    [src, swell].forEach((n) => n.stop());
  };
};

const nightBreeze: Sound = (ctx, bus) => {
  const src = noise(ctx, "pink");
  const bp = filter(ctx, "bandpass", 600, 0.9);
  const g = gain(ctx, 0.3);
  chain(src, bp, g, bus);
  const sweep = lfo(ctx, 0.06, 300, bp.frequency);
  const gust = lfo(ctx, 0.09, 0.14, g.gain);
  src.start();
  return () => [src, sweep, gust].forEach((n) => n.stop());
};

const starlightHum: Sound = (ctx, bus) => {
  const lp = filter(ctx, "lowpass", 1200);
  lp.connect(bus);
  const stopPad = pad(ctx, lp, [midi(45), midi(52), midi(57), midi(61)], 0.05);
  // A twinkle up high every few seconds.
  const twinkle = gain(ctx, 0.05);
  twinkle.connect(bus);
  const scale = [81, 83, 85, 88, 90, 93];
  const stop = every(ctx, (t) => {
    note(ctx, twinkle, t, midi(pick(scale)), { level: 1, decay: 2.5, partials: BELL });
    return t + between(4, 9);
  });
  return () => {
    stop();
    stopPad();
  };
};

// Slow lullaby in C major pentatonic, in threes.
const musicBox: Sound = (ctx, bus) => {
  const out = gain(ctx, 0.16);
  out.connect(bus);
  const tune = wanderingTune([72, 74, 76, 79, 81, 84, 86, 88]);
  const stop = every(ctx, (t) => {
    const { freq, phraseEnd } = tune();
    note(ctx, out, t, freq, { level: 1, decay: phraseEnd ? 2.4 : 1.6, partials: MUSIC_BOX });
    return t + (phraseEnd ? 1.8 : 0.62);
  });
  return stop;
};

// Brighter and quicker, with a soft bass on the beat.
const happyBox: Sound = (ctx, bus) => {
  const out = gain(ctx, 0.15);
  out.connect(bus);
  const tune = wanderingTune([67, 69, 72, 74, 76, 79, 81, 84], 16);
  const bass = [48, 48, 55, 57, 53, 53, 55, 55];
  let beat = 0;
  const stop = every(ctx, (t) => {
    const { freq } = tune();
    note(ctx, out, t, freq, { level: 0.9, decay: 0.9, partials: MUSIC_BOX });
    if (beat % 4 === 0) note(ctx, out, t, midi(bass[(beat / 4) % bass.length]), { level: 0.7, decay: 1.2, partials: [[1, 1], [2, 0.2]] });
    beat++;
    return t + 0.3;
  });
  return stop;
};

// Marimba arpeggios over C - G - Am - F, with a soft thump and shaker.
const sunnyMarimba: Sound = (ctx, bus) => {
  const out = gain(ctx, 0.17);
  out.connect(bus);
  const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
  const patterns = [[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1]];
  const beatSec = 60 / 104 / 2;
  let step = 0;
  let pattern = patterns[0];
  const stop = every(ctx, (t) => {
    const bar = Math.floor(step / 8);
    const chord = chords[bar % chords.length];
    if (step % 8 === 0) pattern = pick(patterns);
    const idx = pattern[step % 4];
    const octave = step % 8 >= 4 ? 12 : 0;
    note(ctx, out, t, midi(chord[idx] + 12 + octave), { level: 1, decay: 0.55, partials: MARIMBA });
    if (step % 8 === 0) note(ctx, out, t, midi(chord[0] - 12), { level: 0.8, decay: 1.4, partials: MARIMBA });
    if (step % 4 === 0) thump(ctx, out, t);
    if (step % 2 === 1) shaker(ctx, out, t);
    step++;
    return t + beatSec;
  });
  return stop;
};

function thump(ctx: BaseAudioContext, out: AudioNode, t: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.14);
  env.gain.setValueAtTime(0.5, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  chain(osc, env, out);
  osc.start(t);
  osc.stop(t + 0.2);
}

let shakerBuffer: AudioBuffer | null = null;
function shaker(ctx: BaseAudioContext, out: AudioNode, t: number) {
  if (!shakerBuffer || shakerBuffer.sampleRate !== ctx.sampleRate) {
    const length = Math.floor(ctx.sampleRate * 0.05);
    shakerBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    shakerBuffer.getChannelData(0).set(fillNoise("white", length));
  }
  const src = ctx.createBufferSource();
  src.buffer = shakerBuffer;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.12, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  chain(src, filter(ctx, "highpass", 6000), env, out);
  src.start(t);
}

// Bubbly pops on a pentatonic scale over a warm major pad.
const bubblePop: Sound = (ctx, bus) => {
  const out = gain(ctx, 0.16);
  out.connect(bus);
  const stopPad = pad(ctx, out, [midi(53), midi(57), midi(60)], 0.12);
  const scale = [65, 67, 69, 72, 74, 77, 79, 81];
  const stop = every(ctx, (t) => {
    if (Math.random() < 0.7) {
      const f = midi(pick(scale));
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.07);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.9, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      chain(osc, env, out);
      osc.start(t);
      osc.stop(t + 0.25);
    }
    return t + 0.25;
  });
  return () => {
    stop();
    stopPad();
  };
};

// A steady, low hum for focus: deep noise and a quiet low chord.
const spaceHum: Sound = (ctx, bus) => {
  const src = noise(ctx, "brown");
  chain(src, filter(ctx, "lowpass", 420), gain(ctx, 0.42), bus);
  src.start();
  const stopPad = pad(ctx, bus, [midi(33), midi(40)], 0.04);
  return () => {
    src.stop();
    stopPad();
  };
};

// A soft chime every few seconds, low and slow.
const slowChimes: Sound = (ctx, bus) => {
  const out = gain(ctx, 0.14);
  out.connect(bus);
  const bed = noise(ctx, "pink");
  chain(bed, filter(ctx, "lowpass", 900), gain(ctx, 0.05), bus);
  bed.start();
  const scale = [60, 62, 64, 67, 69, 72, 74, 76];
  const stop = every(ctx, (t) => {
    note(ctx, out, t, midi(pick(scale)), { level: 1, decay: 4.5, partials: BELL });
    return t + between(2.5, 5);
  });
  return () => {
    stop();
    bed.stop();
  };
};

// A rhyme's tune from `offsetSec` on: each note on the music box or marimba
// (an octave up, where they sound sweetest), with a soft bass note at the
// start of each line.
export function rhymeSound(rhyme: Rhyme, offsetSec: number): Sound {
  const { notes, lines } = rhymeTimeline(rhyme);
  const partials = rhyme.voice === "marimba" ? MARIMBA : MUSIC_BOX;
  const events = [
    ...notes.map((n) => ({ at: n.at, midi: n.midi + 12, decay: Math.max(0.6, n.dur * 1.6), level: 1 })),
    ...lines.map((l) => ({ at: l.start, midi: notes.find((n) => n.at >= l.start)!.midi - 12, decay: 1.6, level: 0.5 })),
  ]
    .filter((e) => e.at >= offsetSec)
    .sort((a, b) => a.at - b.at);
  return (ctx, bus) => {
    const out = gain(ctx, 0.17);
    out.connect(bus);
    const t0 = ctx.currentTime + 0.1 - offsetSec;
    let i = 0;
    const tick = () => {
      while (i < events.length && t0 + events[i].at < ctx.currentTime + 3) {
        const e = events[i++];
        note(ctx, out, Math.max(ctx.currentTime, t0 + e.at), midi(e.midi), { level: e.level, decay: e.decay, partials });
      }
    };
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  };
}

export const SOUNDS: Record<AmbienceKey, Sound> = {
  starlight_hum: starlightHum,
  night_breeze: nightBreeze,
  soft_rain: softRain,
  gentle_waves: gentleWaves,
  deep_sea: deepSea,
  music_box: musicBox,
  happy_box: happyBox,
  sunny_marimba: sunnyMarimba,
  bubble_pop: bubblePop,
  space_hum: spaceHum,
  slow_chimes: slowChimes,
  pink_rain: pinkRain,
};
