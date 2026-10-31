import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tslOperatorPlugin from "vite-plugin-tsl-operator";

// Aurelia's jellyfish shaders (Calm Space's ocean) write maths with plain
// operators inside three.js `Fn(...)` blocks; this plugin turns them into
// node calls. Applied only to the Aurelia folder, so no other file is parsed.
function aureliaShaders(): Plugin {
  const plugin = tslOperatorPlugin({ logs: false }) as Plugin;
  const transform = plugin.transform as (this: unknown, code: string, id: string) => ReturnType<Extract<Plugin["transform"], (...args: never[]) => unknown>>;
  return {
    name: "aurelia-tsl-operators",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").includes("/anxiety/ocean/aurelia/")) return null;
      return transform.call(this, code, id);
    },
  };
}

export default defineConfig({
  plugins: [react(), aureliaShaders()],
  server: { port: 5173 },
});
