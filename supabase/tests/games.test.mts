// Games Corner storage (migration 20261029100000, Sprint 4), under the hosted
// project's default privileges: who can write and read progress, caregiver
// authorization, denial for everyone else, the atomic round function, and the
// child `games` Edge Function handler with real child tokens.
// Usage: npx tsx supabase/tests/games.test.mts
(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "games-test-secret" : undefined) } };

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPin } from "../functions/_shared/pin.ts";
import { GAME_IDS as SHARED_IDS, GAME_DIFFICULTIES } from "../../packages/shared-types/src/index.ts";
import * as G from "../functions/_shared/games.ts";

const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { createGamesHandler } = await import("../functions/games/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const MIGRATION = "20261029100000_game_progress.sql";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

// The three lists of game ids and levels must agree.
const sql = readFileSync(dir + MIGRATION, "utf8");
const sqlIds = [...(sql.match(/game_id in \(([^)]*)\)/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
ok("game ids agree: migration, edge function and shared-types", JSON.stringify(sqlIds) === JSON.stringify(SHARED_IDS) &&
  JSON.stringify([...G.GAME_IDS]) === JSON.stringify(SHARED_IDS) && JSON.stringify([...G.DIFFICULTIES]) === JSON.stringify(GAME_DIFFICULTIES));

const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create role authenticated;
  create role anon;
  create role service_role bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public
    grant references, trigger, truncate on tables to anon, authenticated, service_role;
`);
for (const f of files) await db.exec(readFileSync(dir + f, "utf8"));
ok("all migrations apply under hosted default privileges", true);

const as = async <T,>(role: string, uid: string, q: string, params: unknown[] = []) => {
  await db.exec(`set role ${role}; select set_config('app.uid', '${uid}', false);`);
  try { return (await db.query<T>(q, params)).rows; } finally { await db.exec(`reset role;`); }
};
const err = async (role: string, uid: string, q: string, params: unknown[] = []) => {
  try { await as(role, uid, q, params); return "no_error"; } catch (e) { return (e as Error).message; }
};
const mk = async (role: string) =>
  (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`, [JSON.stringify({ role })])).rows[0].id;

const adultA = await mk("user");
const adultB = await mk("user");
const primary = await mk("caregiver");
const stranger = await mk("caregiver");
const linkedCg = await mk("caregiver");
const hash = await hashPin("4826");
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Asha', 10, $2, '{autism}') id`, [primary, hash]))[0].id;
const otherKid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Ravi', 9, $2, '{adhd}') id`, [stranger, hash]))[0].id;

// ---------------------------------------------------------------------------
// Adults
// ---------------------------------------------------------------------------
const rec = (uid: string, g: string, d: string, s: number | null) =>
  as<any>("authenticated", uid, `select * from record_game_round($1, $2, $3)`, [g, d, s]);

await rec(adultA, "memory-match", "easy", 70);
await rec(adultA, "memory-match", "easy", 90);
const r3 = (await rec(adultA, "memory-match", "easy", 60))[0];
ok("adult: rounds add up and the best score is kept", r3.rounds_completed === 3 && r3.best_score === 90);
ok("adult: a null score keeps the best score; first null stays null",
  (await rec(adultA, "memory-match", "easy", null))[0].best_score === 90 && (await rec(adultA, "imagine-create", "easy", null))[0].best_score === null);
ok("adult: levels are tracked separately", (await rec(adultA, "memory-match", "hard", 50))[0].rounds_completed === 1);
ok("adult: reads back only their own rows",
  (await as<any>("authenticated", adultA, `select * from game_progress`)).length === 3 &&
  (await as<any>("authenticated", adultB, `select * from game_progress`)).length === 0);
ok("adult: another adult can't read or change those rows",
  (await as<any>("authenticated", adultB, `select * from game_progress where profile_id = $1`, [adultA])).length === 0 &&
  (await as<any>("authenticated", adultB, `update game_progress set rounds_completed = 99 where profile_id = $1 returning id`, [adultA])).length === 0);
ok("adult: the record function always uses the caller (no way to name another owner)",
  (await db.query<{ n: number }>(`select count(*)::int n from game_progress where profile_id = $1`, [adultB])).rows[0].n === 0);
ok("adult: bad game, level and score are refused",
  (await err("authenticated", adultA, `select * from record_game_round('chess', 'easy', 5)`)).includes("violates check") &&
  (await err("authenticated", adultA, `select * from record_game_round('memory-match', 'extreme', 5)`)).includes("violates check") &&
  (await err("authenticated", adultA, `select * from record_game_round('memory-match', 'easy', 101)`)).includes("invalid_input") &&
  (await err("authenticated", adultA, `select * from record_game_round('memory-match', 'easy', -1)`)).includes("invalid_input"));
ok("adult: can't create a row owned by a child or by someone else",
  (await err("authenticated", adultA, `insert into game_progress (child_id, game_id, difficulty) values ($1, 'memory-match', 'easy')`, [kid])).includes("row-level security") &&
  (await err("authenticated", adultA, `insert into game_progress (profile_id, game_id, difficulty) values ($1, 'memory-match', 'easy')`, [adultB])).includes("row-level security"));
ok("adult: can't leave a row with no owner or two owners",
  (await err("postgres", "", `insert into game_progress (game_id, difficulty) values ('memory-match', 'easy')`)).includes("game_progress_one_owner") &&
  (await err("postgres", "", `insert into game_progress (profile_id, child_id, game_id, difficulty) values ($1, $2, 'memory-match', 'easy')`, [adultA, kid])).includes("game_progress_one_owner"));
ok("adult: can delete their own game data", (await as<any>("authenticated", adultA, `delete from game_progress where game_id = 'imagine-create' returning id`)).length === 1);

// Preferences
const savePref = (uid: string, d = "medium", rm = true, snd = false, voice = true) =>
  as<any>("authenticated", uid, `select * from save_game_preferences($1, $2, $3, $4)`, [d, rm, snd, voice]);
const p1 = (await savePref(adultA))[0];
ok("preferences: saved with level, reduced motion, sound and read-aloud",
  p1.difficulty === "medium" && p1.reduced_motion === true && p1.sound_enabled === false && p1.voice_enabled === true);
await savePref(adultA, "hard", false, true, false);
ok("preferences: saving again updates the one row",
  (await as<any>("authenticated", adultA, `select * from game_preferences`)).length === 1 &&
  (await as<any>("authenticated", adultA, `select difficulty from game_preferences`))[0].difficulty === "hard");
ok("preferences: private to their owner", (await as<any>("authenticated", adultB, `select * from game_preferences`)).length === 0);
ok("preferences: bad level refused", (await err("authenticated", adultA, `select * from save_game_preferences('wild', false, true, false)`)).includes("violates check"));

// ---------------------------------------------------------------------------
// Anonymous and clients calling child-only functions
// ---------------------------------------------------------------------------
ok("anon: no access to tables or functions",
  (await err("anon", "", `select * from game_progress`)).includes("permission denied") &&
  (await err("anon", "", `select * from game_preferences`)).includes("permission denied") &&
  (await err("anon", "", `select * from record_game_round('memory-match', 'easy', 5)`)).includes("permission denied"));
ok("signed-in users can't call the child-only functions for any child id",
  (await err("authenticated", primary, `select * from record_child_game_round($1, 'memory-match', 'easy', 5)`, [kid])).includes("permission denied") &&
  (await err("authenticated", adultA, `select * from save_child_game_preferences($1, 'easy', false, true, false)`, [kid])).includes("permission denied"));

// ---------------------------------------------------------------------------
// Children (service role via the Edge Function) and caregiver authorization
// ---------------------------------------------------------------------------
const child = (id: string, g: string, d: string, s: number | null) =>
  as<any>("service_role", "", `select * from record_child_game_round($1, $2, $3, $4)`, [id, g, d, s]);
await child(kid, "pattern-quest", "easy", 80);
const k2 = (await child(kid, "pattern-quest", "easy", 100))[0];
await child(otherKid, "pattern-quest", "easy", 10);
ok("child: rounds add up for the child, with the best score", k2.rounds_completed === 2 && k2.best_score === 100 && k2.child_id === kid && k2.profile_id === null);
await as("service_role", "", `select * from save_child_game_preferences($1, 'easy', true, false, false)`, [kid]);
ok("child: preferences saved once per child",
  (await as<any>("service_role", "", `select * from game_preferences where child_id = $1`, [kid])).length === 1);

ok("caregiver: reads their own child's progress and preferences",
  (await as<any>("authenticated", primary, `select * from game_progress where child_id = $1`, [kid])).length === 1 &&
  (await as<any>("authenticated", primary, `select * from game_preferences where child_id = $1`, [kid])).length === 1);
ok("caregiver: can't see another family's child (even by knowing the id)",
  (await as<any>("authenticated", primary, `select * from game_progress where child_id = $1`, [otherKid])).length === 0 &&
  (await as<any>("authenticated", stranger, `select * from game_progress where child_id = $1`, [kid])).length === 0);
ok("caregiver: sees only their own children when reading everything",
  (await as<any>("authenticated", primary, `select child_id from game_progress`)).every((r: any) => r.child_id === kid));
ok("caregiver: read-only (can't write, change or delete a child's progress)",
  (await err("authenticated", primary, `insert into game_progress (child_id, game_id, difficulty) values ($1, 'maze-explorer', 'easy')`, [kid])).includes("row-level security") &&
  (await as<any>("authenticated", primary, `update game_progress set rounds_completed = 99 where child_id = $1 returning id`, [kid])).length === 0 &&
  (await as<any>("authenticated", primary, `delete from game_progress where child_id = $1 returning id`, [kid])).length === 0);
ok("caregiver: a signed-in adult with no link to the child can't see it",
  (await as<any>("authenticated", adultB, `select * from game_progress where child_id = $1`, [kid])).length === 0);
await db.query(`insert into caregiver_user_links (caregiver_id, user_id, status) values ($1, $2, 'active')`, [linkedCg, adultA]);
ok("caregiver: a caregiver linked to an adult sees none of that adult's game data",
  (await as<any>("authenticated", linkedCg, `select * from game_progress where profile_id = $1`, [adultA])).length === 0 &&
  (await as<any>("authenticated", linkedCg, `select * from game_preferences where profile_id = $1`, [adultA])).length === 0);
// The age-15 rule: a young person who chose not to share hides activity (including games) from caregivers.
{
  const teen = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Mina', 16, $2, '{}') id`, [primary, hash]))[0].id;
  await child(teen, "memory-match", "easy", 60);
  await db.query(`update children set birth_year = extract(year from current_date)::int - 16, birth_month = 1, shares_with_caregiver = false where id = $1`, [teen]);
  ok("age 15+: a caregiver sees no game progress while the young person isn't sharing",
    (await as<any>("authenticated", primary, `select * from game_progress where child_id = $1`, [teen])).length === 0);
  await db.query(`update children set shares_with_caregiver = true where id = $1`, [teen]);
  ok("age 15+: and sees it once they choose to share",
    (await as<any>("authenticated", primary, `select * from game_progress where child_id = $1`, [teen])).length === 1);
  await db.query(`update children set shares_with_caregiver = false where id = $1`, [teen]);
  ok("age 15+: sharing can be turned off again", (await as<any>("authenticated", primary, `select * from game_progress where child_id = $1`, [teen])).length === 0);
}
ok("child: rows disappear with the child (cascade)", await (async () => {
  const tmp = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Temp', 8, $2, '{}') id`, [primary, hash]))[0].id;
  await child(tmp, "maze-explorer", "easy", 50);
  await db.query(`delete from children where id = $1`, [tmp]);
  return (await db.query<{ n: number }>(`select count(*)::int n from game_progress where child_id = $1`, [tmp])).rows[0].n === 0;
})());

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------
const p = (b: unknown) => G.parseGamesRequest(b);
ok("parse: not an object is 400; missing token is 401",
  (p(null) as any).error === "invalid_request" && (p({ action: "get_state" }) as any).status === 401 &&
  (p({ action: "get_state", child_session_token: 5 }) as any).error === "invalid_session");
ok("parse: unknown action rejected", (p({ action: "wipe", child_session_token: "t" }) as any).error === "invalid_action");
ok("parse: record_round needs a known game, level and a whole score 0-100 (or none)",
  p({ action: "record_round", child_session_token: "t", game_id: "memory-match", difficulty: "easy", score: 50 }).ok &&
  p({ action: "record_round", child_session_token: "t", game_id: "memory-match", difficulty: "easy" }).ok &&
  p({ action: "record_round", child_session_token: "t", game_id: "memory-match", difficulty: "easy", score: null }).ok &&
  !p({ action: "record_round", child_session_token: "t", game_id: "poker", difficulty: "easy" }).ok &&
  !p({ action: "record_round", child_session_token: "t", game_id: "memory-match", difficulty: "nightmare" }).ok &&
  !p({ action: "record_round", child_session_token: "t", game_id: "memory-match", difficulty: "easy", score: 100.5 }).ok &&
  !p({ action: "record_round", child_session_token: "t", game_id: "memory-match", difficulty: "easy", score: 101 }).ok &&
  !p({ action: "record_round", child_session_token: "t", game_id: "memory-match", difficulty: "easy", score: "9" }).ok);
ok("parse: save_preferences needs every field with the right type",
  p({ action: "save_preferences", child_session_token: "t", preferences: { difficulty: "easy", reduced_motion: true, sound_enabled: false, voice_enabled: false } }).ok &&
  !p({ action: "save_preferences", child_session_token: "t", preferences: { difficulty: "easy", reduced_motion: "yes", sound_enabled: false, voice_enabled: false } }).ok &&
  !p({ action: "save_preferences", child_session_token: "t" }).ok);

// ---------------------------------------------------------------------------
// Handler with an in-memory store and real child tokens
// ---------------------------------------------------------------------------
const CHILD_A = "11111111-1111-4111-8111-111111111111";
const CHILD_B = "22222222-2222-4222-8222-222222222222";

function world() {
  const progress: Record<string, G.ProgressRow[]> = {};
  const prefs: Record<string, G.PreferencesRow> = {};
  const creations: Record<string, G.CreationRow[]> = {};
  const logs: string[] = [];
  const calls: string[] = [];
  const cfg = { fail: false };
  const store = {
    async listProgress(id: string) { calls.push("list"); if (cfg.fail) throw new Error("db down"); return progress[id] ?? []; },
    async getPreferences(id: string) { calls.push("prefs"); return prefs[id] ?? null; },
    async recordRound(id: string, g: string, d: string, s: number | null) {
      calls.push("record");
      const rows = (progress[id] ??= []);
      const row = rows.find((r) => r.game_id === g && r.difficulty === d);
      if (row) { row.rounds_completed++; if (s !== null) row.best_score = Math.max(row.best_score ?? 0, s); }
      else rows.push({ game_id: g, difficulty: d, rounds_completed: 1, best_score: s, last_played_at: "2026-10-24T10:00:00Z" });
    },
    async savePreferences(id: string, pr: G.PreferencesInput) {
      calls.push("save");
      prefs[id] = { difficulty: pr.difficulty, reduced_motion: pr.reducedMotion, sound_enabled: pr.soundEnabled, voice_enabled: pr.voiceEnabled };
    },
    async listCreations(id: string) { calls.push("creations"); return [...(creations[id] ?? [])].reverse(); },
    async saveCreation(id: string, c: G.CreationInput) {
      calls.push("keep");
      const rows = (creations[id] ??= []);
      if (!rows.some((r) => r.id === c.id)) rows.push({ id: c.id, kind: c.kind, content: c.content, created_at: `2026-10-24T10:00:0${rows.length}Z` });
    },
    async deleteCreation(id: string, cid: string) {
      calls.push("forget");
      creations[id] = (creations[id] ?? []).filter((r) => r.id !== cid);
    },
  };
  const handler = createGamesHandler({ store, verifyChildToken, log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`) });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/games", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const t = await res.text();
    let j: any = null;
    try { j = JSON.parse(t); } catch { /* preflight */ }
    return { status: res.status, json: j, text: t, cors: res.headers.get("Access-Control-Allow-Origin") };
  };
  return { call, calls, logs, cfg, progress, creations };
}

const tokenA = await signChildToken(CHILD_A);
const tokenB = await signChildToken(CHILD_B);
{
  const w = world();
  const pre = await w.call(null, { method: "OPTIONS" });
  ok("handler: OPTIONS is 200 with CORS before any store work; GET is 405",
    pre.status === 200 && pre.cors === "*" && w.calls.length === 0 && (await w.call(null, { method: "GET" })).status === 405);
  const [payload] = tokenA.split(".");
  const bad = await w.call(null, { raw: "{oops" });
  const big = await w.call(null, { raw: JSON.stringify({ pad: "x".repeat(9000) }) });
  const tampered = await w.call({ action: "get_state", child_session_token: `${payload}.AAAA` });
  const none = await w.call({ action: "get_state" });
  ok("handler: bad JSON 400, oversized 413, tampered or missing token 401, no store work",
    bad.status === 400 && big.status === 413 && tampered.status === 401 && none.status === 401 && w.calls.length === 0);
}
{
  const w = world();
  const empty = await w.call({ action: "get_state", child_session_token: tokenA });
  ok("handler: a new child has no progress and no saved preferences", empty.status === 200 && empty.json.progress.length === 0 && empty.json.preferences === null);
  await w.call({ action: "record_round", child_session_token: tokenA, game_id: "memory-match", difficulty: "easy", score: 80 });
  await w.call({ action: "record_round", child_session_token: tokenA, game_id: "memory-match", difficulty: "easy", score: 60 });
  await w.call({ action: "save_preferences", child_session_token: tokenA, preferences: { difficulty: "medium", reduced_motion: true, sound_enabled: false, voice_enabled: true } });
  const a = await w.call({ action: "get_state", child_session_token: tokenA });
  ok("handler: progress and preferences come back in the contract shape",
    a.json.progress[0].gameId === "memory-match" && a.json.progress[0].roundsCompleted === 2 && a.json.progress[0].bestScore === 80 &&
    a.json.preferences.difficulty === "medium" && a.json.preferences.reducedMotion === true && a.json.preferences.voiceEnabled === true);
  const b = await w.call({ action: "get_state", child_session_token: tokenB });
  ok("handler: one child never sees another child's progress (cross-user isolation)", b.json.progress.length === 0 && b.json.preferences === null);
  ok("handler: a client-supplied child_id is ignored", await (async () => {
    await w.call({ action: "record_round", child_session_token: tokenB, child_id: CHILD_A, game_id: "maze-explorer", difficulty: "easy", score: 5 });
    return (w.progress[CHILD_A] ?? []).every((r) => r.game_id !== "maze-explorer") && (w.progress[CHILD_B] ?? []).length === 1;
  })());
  const invalid = await w.call({ action: "record_round", child_session_token: tokenA, game_id: "memory-match", difficulty: "easy", score: 500 });
  ok("handler: an impossible score is 400 invalid_input", invalid.status === 400 && invalid.json.error === "invalid_input");
}
{
  const w = world();
  w.cfg.fail = true;
  const r = await w.call({ action: "get_state", child_session_token: tokenA });
  ok("handler: a database failure is a generic 500 that doesn't leak details", r.status === 500 && r.json.error === "internal_error" && !r.text.includes("db down"));
  // Repeated taps: the same round sent twice counts twice, because they are two rounds.
  w.cfg.fail = false;
  await Promise.all([1, 2, 3].map(() => w.call({ action: "record_round", child_session_token: tokenA, game_id: "pattern-quest", difficulty: "hard", score: 40 })));
  ok("handler: concurrent saves all count", w.progress[CHILD_A][0].rounds_completed === 3);
}

// ---------------------------------------------------------------------------
// Creations (Imagine & Create), private to the child (migration 20261029400000)
// ---------------------------------------------------------------------------
{
  const w = world();
  const story = (id: string, ownText: string) => ({
    id, kind: "story", content: { story: { starterId: "s1", nextKey: "ic.story.s1.n1", endKey: "ic.story.s1.e1", ownText } },
  });
  const keep = (token: string, creation: unknown) => w.call({ action: "save_creation", child_session_token: token, creation });
  const list = (token: string) => w.call({ action: "list_creations", child_session_token: token });

  ok("handler: a child keeps a creation and gets it back, newest first",
    (await keep(tokenA, story("story-1", "The fox found a friend."))).status === 200 &&
    (await keep(tokenA, { id: "character-2", kind: "character", content: { character: { body: "🦊", colorId: "mint", accessory: null, powerKey: null, name: "Pip" } } })).status === 200 &&
    (await (async () => {
      const r = await list(tokenA);
      return r.json.creations.map((c: { id: string }) => c.id).join() === "character-2,story-1" && r.json.creations[1].story.ownText === "The fox found a friend.";
    })()));
  ok("handler: keeping the same one twice changes nothing",
    (await keep(tokenA, story("story-1", "changed"))).status === 200 && w.creations[CHILD_A].length === 2 && w.creations[CHILD_A][0].content.story);
  ok("handler: another child sees none of them", (await list(tokenB)).json.creations.length === 0);
  ok("handler: a child removes their own", (await w.call({ action: "delete_creation", child_session_token: tokenA, id: "story-1" })).status === 200 &&
    (await list(tokenA)).json.creations.length === 1);
  ok("handler: names up to 24, own text up to 240, ids and kinds the game's own",
    (await keep(tokenA, { id: "character-3", kind: "character", content: { character: { name: "x".repeat(25) } } })).status === 400 &&
    (await keep(tokenA, story("story-4", "x".repeat(241)))).status === 400 &&
    (await keep(tokenA, story("Story 5!", "ok"))).status === 400 &&
    (await keep(tokenA, { id: "scene-1", kind: "scene", content: { story: {} } })).status === 400 &&
    (await keep(tokenA, { id: "poem-1", kind: "poem", content: { poem: {} } })).status === 400 &&
    (await w.call({ action: "delete_creation", child_session_token: tokenA, id: "../x" })).status === 400);
  ok("handler: a creation over 4 KB is refused",
    (await keep(tokenA, { id: "scene-2", kind: "scene", content: { scene: { backdropId: "forest", cells: Array(400).fill("🌳🌳") } } })).status === 400);
}
