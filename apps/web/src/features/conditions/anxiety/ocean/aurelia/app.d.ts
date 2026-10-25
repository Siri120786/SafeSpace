// Types for Aurelia's scene (plain JavaScript), as SafeSpace uses it.
import type { WebGPURenderer } from "three/webgpu";

export default class App {
  constructor(renderer: WebGPURenderer, opts?: { width: number; height: number; count?: number; pointerTarget?: EventTarget | null; shift?: number | { x: number; y: number } });
  init(progressCallback?: (fraction: number) => Promise<void>): Promise<void>;
  resize(width: number, height: number): void;
  setShift(shift: number | { x: number; y: number }): void;
  update(delta: number, elapsed: number): Promise<void>;
  dispose(): void;
}
