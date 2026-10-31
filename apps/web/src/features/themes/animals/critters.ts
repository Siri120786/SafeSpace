// The Animals theme's two 3D friends, drawn with three.js (WebGL): Rusty the
// fox on the home page and the bee on the tools page. three.js and the models
// load only when one of those pages opens. Both rest still until the person
// presses Play; then Rusty floats softly and turns toward the pointer, and
// the bee flies (slowly, wings fluttering gently, not at a real bee's
// flicker) to a spot beside each part of the page as it scrolls. If WebGL or
// a model is missing, the page simply shows its pictures without them.

import { BEE_MODEL, BEE_WING, RUSTY_MODEL } from "./media";

export interface CritterScene {
  setPlaying(playing: boolean): void;
  dispose(): void;
}

type Three = typeof import("three");

// Seconds of one slow float, and the bee's wing flutter (beats a second).
export const RUSTY_FLOAT_SECONDS = 5.5;
export const BEE_WING_BEATS = 4;

export function canShowCritters(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

async function loadKit() {
  const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
    import("three"),
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/libs/meshopt_decoder.module.js"),
    import("three/addons/environments/RoomEnvironment.js"),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return { THREE, loader, RoomEnvironment };
}

function makeRenderer(THREE: Three, canvas: HTMLCanvasElement, RoomEnvironment: new () => import("three").Scene, exposure: number) {
  // Kept between draws: while still, a friend is drawn once and must stay.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return { renderer, scene };
}

function sizeTo(renderer: import("three").WebGLRenderer, camera: import("three").PerspectiveCamera, canvas: HTMLCanvasElement) {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  return { w, h };
}

const ease = (now: number, target: number, dt: number, rate: number) => now + (target - now) * (1 - Math.exp(-dt * rate));

// ------------------------------------------------------------------ Rusty

// Where Rusty stands: on wide screens to the right of the greeting, on
// phones above it.
export function rustySpot(width: number): { x: number; y: number; scale: number } {
  return width < 720 ? { x: 0, y: 0.35, scale: 0.6 } : { x: 0.62, y: -0.02, scale: 0.78 };
}

export async function startRusty(canvas: HTMLCanvasElement, opts: { pointerTarget: HTMLElement }): Promise<CritterScene | null> {
  if (!canShowCritters()) return null;
  try {
    const { THREE, loader, RoomEnvironment } = await loadKit();
    const { renderer, scene } = makeRenderer(THREE, canvas, RoomEnvironment, 1.05);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 6);
    scene.add(new THREE.HemisphereLight(0xffe2c0, 0x6b3a12, 1.1));
    const key = new THREE.DirectionalLight(0xffc98a, 2.2);
    key.position.set(-3, 4, 3);
    const rim = new THREE.DirectionalLight(0xffa24d, 1.6);
    rim.position.set(3, 2, -3);
    scene.add(key, rim);

    const gltf = await loader.loadAsync(RUSTY_MODEL);
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    model.position.sub(box.getCenter(new THREE.Vector3()));
    const size = box.getSize(new THREE.Vector3());
    const holder = new THREE.Group();
    holder.scale.setScalar(3.15 / Math.max(size.x, size.y, size.z));
    holder.add(model);
    const pivot = new THREE.Group();
    pivot.add(holder);
    scene.add(pivot);
    model.traverse((o) => {
      const mesh = o as import("three").Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as import("three").MeshStandardMaterial;
      mat.envMapIntensity = 0.7;
      if (mat.map) mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });

    let spot = rustySpot(window.innerWidth);
    let playing = false;
    let frame = 0;
    let disposed = false;
    const target = { x: 0, y: 0 };
    const look = { x: 0, y: 0 };
    const clock = new THREE.Clock();
    let t = 0;

    const pose = () => {
      const bob = playing ? Math.sin((t * 2 * Math.PI) / RUSTY_FLOAT_SECONDS) * 0.07 : 0;
      pivot.scale.setScalar(spot.scale);
      pivot.position.set(spot.x * camera.aspect + look.x * 0.06, spot.y + bob, 0);
      pivot.rotation.z = playing ? Math.sin((t * 2 * Math.PI) / RUSTY_FLOAT_SECONDS + 0.6) * 0.02 : 0;
      pivot.rotation.y = -0.35 + look.x * 0.22;
      pivot.rotation.x = look.y * 0.1;
    };
    const draw = () => {
      pose();
      renderer.render(scene, camera);
    };
    const layout = () => {
      sizeTo(renderer, camera, canvas);
      spot = rustySpot(window.innerWidth);
      draw();
    };
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      look.x = ease(look.x, target.x, dt, 2.4);
      look.y = ease(look.y, target.y, dt, 2.4);
      draw();
      frame = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const r = opts.pointerTarget.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };

    // Redrawn whenever the canvas changes size (a resize clears it).
    const resizer = new ResizeObserver(layout);
    resizer.observe(canvas);
    window.addEventListener("resize", layout);
    layout();
    return {
      setPlaying(next) {
        if (disposed || next === playing) return;
        playing = next;
        cancelAnimationFrame(frame);
        if (playing) {
          clock.getDelta();
          opts.pointerTarget.addEventListener("pointermove", onMove);
          frame = requestAnimationFrame(tick);
        } else {
          opts.pointerTarget.removeEventListener("pointermove", onMove);
          target.x = target.y = look.x = look.y = 0;
          draw();
        }
      },
      dispose() {
        disposed = true;
        cancelAnimationFrame(frame);
        resizer.disconnect();
        window.removeEventListener("resize", layout);
        opts.pointerTarget.removeEventListener("pointermove", onMove);
        renderer.dispose();
      },
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ bee

export interface BeeStop {
  x: number; // -1..1 across the screen
  y: number; // -1..1 up the screen
  s: number; // size
  yaw: number; // degrees: 0 faces right, 180 left, 90 the camera
  pitch: number;
  roll: number;
}

// One stop beside each part of the tools page: the greeting, the cards'
// heading, the closing words.
export function beeStops(width: number): BeeStop[] {
  return width < 760
    ? [
        { x: 0.3, y: 0.42, s: 0.7, yaw: 150, pitch: 6, roll: -4 },
        { x: 0.45, y: 0.62, s: 0.6, yaw: 125, pitch: 10, roll: 6 },
        { x: 0.25, y: 0.55, s: 0.6, yaw: 160, pitch: 8, roll: 4 },
      ]
    : [
        { x: 0.3, y: 0.0, s: 1, yaw: 150, pitch: 6, roll: -4 },
        { x: 0.55, y: 0.55, s: 0.75, yaw: 125, pitch: 10, roll: 6 },
        { x: -0.5, y: 0.3, s: 0.85, yaw: 40, pitch: -6, roll: -8 },
      ];
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a + 540) % 360) + 360) % 360) - 180;
  return a + d * t;
}

// Where the bee should be for this much of the page scrolled (0 = the
// first part's top, 1 = the second's, ...). It rests beside each part and
// flies, dipping a little, between them.
export function beeTarget(stops: BeeStop[], progress: number): BeeStop & { moving: number } {
  const p = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), stops.length - 1) : 0;
  const i = Math.min(stops.length - 2, Math.floor(p));
  const f = p - i;
  const t = easeInOut(Math.min(Math.max((f - 0.12) / 0.76, 0), 1));
  const a = stops[i];
  const b = stops[i + 1];
  const lerp = (u: number, v: number) => u + (v - u) * t;
  const arc = Math.sin(t * Math.PI);
  return {
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y) - arc * 0.22,
    s: lerp(a.s, b.s) * (1 + arc * 0.12),
    yaw: lerpAngle(a.yaw, b.yaw, t),
    pitch: lerp(a.pitch, b.pitch),
    roll: lerp(a.roll, b.roll),
    moving: arc,
  };
}

// The photographed wing on black, turned into a see-through texture.
async function wingTexture(THREE: Three): Promise<import("three").Texture> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = BEE_WING;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 576;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, c.width, c.height);
  const data = g.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
    px[i + 3] = Math.min(Math.max((l - 0.035) * 4.2, 0), 1) * 255;
    px[i] = Math.min(255, px[i] * 1.5 + 30);
    px[i + 1] = Math.min(255, px[i + 1] * 1.5 + 30);
    px[i + 2] = Math.min(255, px[i + 2] * 1.5 + 40);
  }
  g.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export async function startBee(
  canvas: HTMLCanvasElement,
  opts: { sections: () => HTMLElement[]; pointerTarget: HTMLElement },
): Promise<CritterScene | null> {
  if (!canShowCritters()) return null;
  try {
    const { THREE, loader, RoomEnvironment } = await loadKit();
    const { renderer, scene } = makeRenderer(THREE, canvas, RoomEnvironment, 1.15);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    scene.add(new THREE.HemisphereLight(0xf2eeff, 0x7a62c9, 1.3));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(3, 5, 6);
    const back = new THREE.DirectionalLight(0xc8b8ff, 2.2);
    back.position.set(-5, 2, -4);
    scene.add(sun, back);

    const [gltf, wingMap] = await Promise.all([loader.loadAsync(BEE_MODEL), wingTexture(THREE)]);
    const model = gltf.scene;
    model.traverse((o) => {
      const mesh = o as import("three").Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      (mesh.material as import("three").MeshStandardMaterial).envMapIntensity = 0.7;
    });
    const holder = new THREE.Group();
    holder.add(model);
    model.rotation.set(0, Math.PI / 2, 0); // head from +Z to +X
    let box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
    box = new THREE.Box3().setFromObject(holder);
    model.position.sub(box.getCenter(new THREE.Vector3()));
    box = new THREE.Box3().setFromObject(holder);

    const flight = new THREE.Group();
    const beeRoot = new THREE.Group();
    flight.add(beeRoot);
    beeRoot.add(holder);
    scene.add(flight);

    // Wings: two a side, each with two faint copies for a soft blur.
    const flaps: { group: import("three").Group; phase: number }[] = [];
    const anchor = new THREE.Vector3(
      box.min.x + (box.max.x - box.min.x) * 0.66,
      box.max.y * 0.86,
      (box.max.z - box.min.z) * 0.05,
    );
    const wingGeo = (span: number) => {
      const geo = new THREE.PlaneGeometry(span, (span * 9) / 16);
      geo.translate(span / 2 - span * 0.03, 0, 0);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(-Math.PI / 2);
      return geo;
    };
    for (const side of [1, -1]) {
      const sideGroup = new THREE.Group();
      sideGroup.position.copy(anchor);
      sideGroup.scale.z = side;
      beeRoot.add(sideGroup);
      for (const w of [
        { span: 0.72, sweep: -0.42, phase: 0, lift: 0.02 },
        { span: 0.52, sweep: -0.95, phase: -0.5, lift: -0.01 },
      ]) {
        const sweep = new THREE.Group();
        sweep.rotation.y = w.sweep;
        sweep.position.y = w.lift;
        sideGroup.add(sweep);
        const geo = wingGeo(w.span);
        for (const [offset, opacity] of [
          [0, 0.95],
          [0.55, 0.28],
          [-0.55, 0.28],
        ]) {
          const mat = new THREE.MeshBasicMaterial({
            map: wingMap,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const flap = new THREE.Group();
          flap.add(new THREE.Mesh(geo, mat));
          sweep.add(flap);
          flaps.push({ group: flap, phase: w.phase + offset });
        }
      }
    }

    let stops = beeStops(window.innerWidth);
    let playing = false;
    let frame = 0;
    let disposed = false;
    const cur = { ...stops[0], moving: 0 };
    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    const clock = new THREE.Clock();
    let t = 0;

    const progress = () => {
      const tops = opts.sections().map((s) => s.getBoundingClientRect().top + window.scrollY);
      const y = window.scrollY + window.innerHeight * 0.35;
      for (let i = tops.length - 1; i >= 0; i--) {
        if (y >= tops[i]) {
          const next = tops[i + 1];
          return next === undefined ? i : i + Math.min(1, (y - tops[i]) / Math.max(1, next - tops[i]));
        }
      }
      return 0;
    };

    const place = (dt: number) => {
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      const halfW = halfH * camera.aspect;
      const vx = cur.x;
      const vy = cur.y;
      if (playing) {
        const goal = beeTarget(stops, progress());
        cur.x = ease(cur.x, goal.x, dt, 2.2);
        cur.y = ease(cur.y, goal.y, dt, 2.2);
        cur.s = ease(cur.s, goal.s, dt, 2.2);
        cur.pitch = ease(cur.pitch, goal.pitch, dt, 2.2);
        cur.roll = ease(cur.roll, goal.roll, dt, 2.2);
        cur.yaw = lerpAngle(cur.yaw, goal.yaw, 1 - Math.exp(-dt * 1.8));
        cur.moving = goal.moving;
        mouse.sx = ease(mouse.sx, mouse.x, dt, 2);
        mouse.sy = ease(mouse.sy, mouse.y, dt, 2);
      }
      const hover = playing ? Math.sin(t * 1.4) * 0.03 : 0;
      flight.position.set(cur.x * halfW + mouse.sx * 0.1, cur.y * halfH + hover * halfH + mouse.sy * 0.06, 0);
      flight.scale.setScalar(halfH * 2 * 0.26 * cur.s);
      flight.rotation.set(0, -((cur.yaw + mouse.sx * 10) * Math.PI) / 180, 0);
      const speedX = dt > 0 ? (cur.x - vx) / dt : 0;
      const speedY = dt > 0 ? (cur.y - vy) / dt : 0;
      const pitch = cur.pitch - Math.min(Math.max(speedY * 22, -24), 24);
      const roll = cur.roll + Math.min(Math.max(speedX * 18, -24), 24);
      beeRoot.rotation.set((roll * Math.PI) / 180, 0, (pitch * Math.PI) / 180, "YZX");
      const beat = 2 * Math.PI * BEE_WING_BEATS;
      for (const f of flaps) {
        const a = playing ? Math.sin(t * beat + f.phase) : 0;
        f.group.rotation.x = -0.25 + a * 0.6;
        f.group.rotation.y = a * 0.12;
      }
    };
    const draw = (dt: number) => {
      place(dt);
      renderer.render(scene, camera);
    };
    const layout = () => {
      sizeTo(renderer, camera, canvas);
      stops = beeStops(window.innerWidth);
      if (!playing) Object.assign(cur, stops[0], { moving: 0 });
      draw(0);
    };
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      draw(dt);
      frame = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const resizer = new ResizeObserver(layout);
    resizer.observe(canvas);
    window.addEventListener("resize", layout);
    layout();

    return {
      setPlaying(next) {
        if (disposed || next === playing) return;
        playing = next;
        cancelAnimationFrame(frame);
        if (playing) {
          clock.getDelta();
          window.addEventListener("pointermove", onMove);
          frame = requestAnimationFrame(tick);
        } else {
          window.removeEventListener("pointermove", onMove);
          Object.assign(mouse, { x: 0, y: 0, sx: 0, sy: 0 });
          Object.assign(cur, stops[0], { moving: 0 });
          // The canvas moves back into the greeting before the next draw.
          requestAnimationFrame(() => layout());
        }
      },
      dispose() {
        disposed = true;
        cancelAnimationFrame(frame);
        resizer.disconnect();
        window.removeEventListener("resize", layout);
        window.removeEventListener("pointermove", onMove);
        renderer.dispose();
      },
    };
  } catch {
    return null;
  }
}
