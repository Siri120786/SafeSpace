// Uploads song files to the LOCAL Supabase "music" bucket (role-flow 9b).
// Only files that the music catalog lists (a track with that exact path) go
// up, so nothing without a recorded licence can be served. Refuses any API
// URL that isn't localhost: the hosted project gets its files in a separate,
// approved deploy step. Prints no keys.
//
// Usage: pnpm music:upload:local <folder>
//   where <folder> holds the files at their catalog paths, e.g.
//   <folder>/rhymes/twinkle.mp3 for a track with path "rhymes/twinkle.mp3".
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hostedTracks, songProblems } from "../apps/web/src/features/music/catalog.ts";

const folder = process.argv[2];
if (!folder || !existsSync(folder)) {
  console.error("Usage: pnpm music:upload:local <folder with the song files at their catalog paths>");
  process.exit(1);
}

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}

const TYPES: Record<string, string> = { mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4" };
const songs = hostedTracks();
if (songs.length === 0) console.log("The catalog lists no songs yet: nothing to upload.");

let failed = 0;
for (const t of songs) {
  const problems = songProblems(t);
  if (problems.length) {
    console.log(`SKIP ${t.title}: the catalog entry needs ${problems.join(", ")}`);
    failed++;
    continue;
  }
  const file = join(folder, t.source.path);
  if (!existsSync(file)) {
    console.log(`MISSING ${t.source.path}`);
    failed++;
    continue;
  }
  const res = await fetch(`${st.API_URL}/storage/v1/object/music/${t.source.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${st.SERVICE_ROLE_KEY}`,
      "Content-Type": TYPES[t.source.path.split(".").pop()!],
      "x-upsert": "true",
    },
    body: readFileSync(file),
  });
  console.log(`${res.ok ? "UPLOADED" : `FAILED (${res.status})`} ${t.source.path}`);
  if (!res.ok) failed++;
}
if (failed) process.exitCode = 1;
