// The jellyfish ocean behind Calm Space: Aurelia (holtsetio/aurelia, MIT, see
// aurelia/LICENSE) running in a canvas. three.js and the scene load only when
// an ocean page opens. Needs WebGPU (Chrome and Edge); anywhere else, or if
// anything fails, the caller shows the still ocean instead.

export interface OceanScene {
  // Freeze or continue the jellyfish (the last frame stays on screen).
  setPaused(paused: boolean): void;
  // One jellyfish pulse per breath of this many seconds; null = their own pace.
  setPulsePeriod(seconds: number | null): void;
  dispose(): void;
}

// Aurelia's own pace: one pulse about every 5 seconds.
const OWN_PULSE_SECONDS = 5;

export function canShowOcean(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// Fewer jellyfish on small screens, so phones stay cool and smooth.
export function jellyfishCount(width: number): number {
  return width < 700 ? 3 : 5;
}

// On wide screens the page's text sits on the left, so the camera moves left
// and the jellyfish appear in the open water on the right. On phones and
// tablets the text starts lower, so the camera moves down and the jellyfish
// swim in the open water at the top.
export function cameraShiftFor(width: number): { x: number; y: number } {
  return width >= 1024 ? { x: -4.5, y: 0 } : { x: 0, y: -4 };
}

export function pulseScaleFor(seconds: number | null): number {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.min(3, Math.max(0.25, OWN_PULSE_SECONDS / seconds));
}

/**
 * Starts the ocean in `host` (the canvas fills it). Resolves to null when the
 * ocean can't run here; the caller keeps the still ocean.
 */
export async function startOcean(host: HTMLElement, opts: { pointerTarget?: EventTarget } = {}): Promise<OceanScene | null> {
  if (!canShowOcean()) return null;
  try {
    const [THREE, { default: App }, { Medusa }] = await Promise.all([
      import("three/webgpu"),
      import("./aurelia/app.js"),
      import("./aurelia/medusa.js"),
    ]);
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const renderer = new THREE.WebGPURenderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const app = new App(renderer, { width, height, count: jellyfishCount(width), shift: cameraShiftFor(width), pointerTarget: opts.pointerTarget ?? window });
    await app.init();
    if (!(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
      app.dispose();
      renderer.dispose();
      return null;
    }

    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    host.appendChild(canvas);

    const resizer = new ResizeObserver(() => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h);
      app.resize(w, h);
      app.setShift(cameraShiftFor(w));
    });
    resizer.observe(host);

    const clock = new THREE.Clock();
    let paused = false;
    let disposed = false;
    let frame = 0;
    let elapsed = 0;
    const loop = async () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 1 / 20);
      if (!paused && !document.hidden) {
        elapsed += delta;
        try {
          await app.update(delta, elapsed);
        } catch {
          // A lost GPU device: stop quietly; the still ocean is behind.
          disposed = true;
          return;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return {
      setPaused(p) {
        paused = p;
        clock.getDelta();
      },
      setPulsePeriod(seconds) {
        Medusa.pulseScale = pulseScaleFor(seconds);
      },
      dispose() {
        disposed = true;
        cancelAnimationFrame(frame);
        resizer.disconnect();
        Medusa.pulseScale = 1;
        app.dispose();
        renderer.dispose();
        canvas.remove();
      },
    };
  } catch {
    return null;
  }
}
