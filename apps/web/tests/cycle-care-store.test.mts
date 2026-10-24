/**
 * Cycle Care saved to the account (lib/cycleCareStore.ts): loading, saving a
 * change shortly after, changes made before the account copy arrives, a
 * failed load or save, "Delete my data", and old data left in the browser
 * under the shared keys (save it to my account, or delete it).
 * Run with: tsx apps/web/tests/cycle-care-store.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { CycleCareStore, LEGACY_KEYS, type CycleCareBackend, type PartValues } from "../src/features/wellness-modules/lib/cycleCareStore.ts";
import type { KeyValueStore } from "../src/features/wellness-modules/lib/deviceStore.ts";

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));

function account(initial: Partial<PartValues> = {}) {
  const row: PartValues = { condition: null, diet: null, profile: null, exercise: null, ...initial };
  const saves: Partial<PartValues>[] = [];
  const fail = { load: false, save: false };
  const backend: CycleCareBackend = {
    async load() { if (fail.load) throw new Error("offline"); return { ...row }; },
    async save(parts) { if (fail.save) throw new Error("offline"); saves.push(parts); Object.assign(row, parts); },
    async remove() { row.condition = row.diet = row.profile = row.exercise = null; },
  };
  return { row, saves, fail, backend };
}

function browser(entries: Record<string, string> = {}): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(entries));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

await test("loads the person's saved parts", async () => {
  const a = account({ condition: "pcod", diet: { plan: { breakfast: ["Oats"] } } });
  const s = new CycleCareStore(a.backend, browser(), 0);
  assert.equal(s.status, "loading");
  await s.load();
  assert.equal(s.status, "ready");
  assert.equal(s.get("condition"), "pcod");
  assert.deepEqual(s.get("diet"), { plan: { breakfast: ["Oats"] } });
  assert.equal(s.get("exercise"), null);
});

await test("a change is saved to the account shortly after, one part at a time", async () => {
  const a = account();
  const s = new CycleCareStore(a.backend, browser(), 0);
  await s.load();
  s.set("condition", "pcos");
  assert.equal(a.saves.length, 0, "not instantly");
  await wait();
  assert.deepEqual(a.saves, [{ condition: "pcos" }]);
  assert.equal(a.row.condition, "pcos");
});

await test("quick changes to one part are saved once, with the last value", async () => {
  const a = account();
  const s = new CycleCareStore(a.backend, browser(), 20);
  await s.load();
  s.set("exercise", { log: [1] });
  s.set("exercise", { log: [1, 2] });
  await wait(40);
  assert.deepEqual(a.saves, [{ exercise: { log: [1, 2] } }]);
});

await test("a change made before the account copy arrives is kept and saved", async () => {
  const a = account({ condition: "unsure" });
  const s = new CycleCareStore(a.backend, browser(), 0);
  s.set("condition", "pcod");
  await s.load();
  assert.equal(s.get("condition"), "pcod");
  await wait();
  assert.equal(a.row.condition, "pcod");
});

await test("a failed save is shown, and the next change tries again", async () => {
  const a = account();
  const s = new CycleCareStore(a.backend, browser(), 0);
  await s.load();
  a.fail.save = true;
  s.set("diet", { plan: {} });
  await wait();
  assert.equal(s.saveFailed("diet"), true);
  a.fail.save = false;
  s.set("diet", { plan: { lunch: ["Dal"] } });
  await wait();
  assert.equal(s.saveFailed("diet"), false);
  assert.deepEqual(a.row.diet, { plan: { lunch: ["Dal"] } });
});

await test("if the account copy didn't load, changes aren't saved over it and say so", async () => {
  const a = account({ diet: { plan: { dinner: ["Soup"] } } });
  a.fail.load = true;
  const s = new CycleCareStore(a.backend, browser(), 0);
  await s.load();
  assert.equal(s.status, "failed");
  s.set("diet", { plan: {} });
  await wait();
  assert.equal(a.saves.length, 0);
  assert.equal(s.saveFailed("diet"), true);
  assert.deepEqual(a.row.diet, { plan: { dinner: ["Soup"] } });
});

await test("flush saves anything waiting at once (before signing out)", async () => {
  const a = account();
  const s = new CycleCareStore(a.backend, browser(), 10_000);
  await s.load();
  s.set("profile", { sleep: "ok" });
  await s.flush();
  assert.deepEqual(a.row.profile, { sleep: "ok" });
});

await test("Delete my data clears the account, waiting saves and any old browser data", async () => {
  const a = account({ condition: "pcos" });
  const b = browser({ [LEGACY_KEYS.diet]: JSON.stringify({ plan: {} }) });
  const s = new CycleCareStore(a.backend, b, 10_000);
  await s.load();
  s.set("exercise", { log: [1] });
  await s.deleteAll();
  await s.flush();
  assert.equal(a.row.condition, null);
  assert.equal(a.row.exercise, null);
  assert.equal(s.get("condition"), null);
  assert.equal(b.map.size, 0);
  assert.equal(s.legacy, null);
});

await test("no old browser data: nothing to ask", async () => {
  const s = new CycleCareStore(account().backend, browser(), 0);
  await s.load();
  assert.equal(s.legacy, null);
});

await test("old browser data: found, and saved to the account only where the account is empty", async () => {
  const a = account({ condition: "pcod" });
  const b = browser({
    [LEGACY_KEYS.condition]: JSON.stringify("pcos"),
    [LEGACY_KEYS.diet]: JSON.stringify({ plan: { breakfast: ["Idli"] } }),
    "something-else": "kept",
  });
  const s = new CycleCareStore(a.backend, b, 0);
  await s.load();
  assert.deepEqual(s.legacy, { condition: "pcos", diet: { plan: { breakfast: ["Idli"] } } });
  await s.adoptLegacy();
  assert.equal(a.row.condition, "pcod", "the account's own label wins");
  assert.deepEqual(a.row.diet, { plan: { breakfast: ["Idli"] } });
  assert.deepEqual([...b.map.keys()], ["something-else"], "only the old Cycle Care keys are removed");
  assert.equal(s.legacy, null);
});

await test("old browser data: deleting it leaves the account as it was", async () => {
  const a = account();
  const b = browser({ [LEGACY_KEYS.profile]: JSON.stringify({ sleep: "poor" }) });
  const s = new CycleCareStore(a.backend, b, 0);
  await s.load();
  s.discardLegacy();
  assert.equal(b.map.size, 0);
  assert.equal(a.row.profile, null);
  assert.equal(a.saves.length, 0);
});

await test("damaged old data is still offered for deletion", async () => {
  const b = browser({ [LEGACY_KEYS.exercise]: "{not json" });
  const s = new CycleCareStore(account().backend, b, 0);
  await s.load();
  assert.deepEqual(s.legacy, {});
  s.discardLegacy();
  assert.equal(b.map.size, 0);
});

console.log(`${passed} cycle-care-store checks`);
