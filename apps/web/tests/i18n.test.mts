/**
 * English, Hindi and Telugu (src/i18n/locales). Run with:
 * tsx apps/web/tests/i18n.test.mts (part of `pnpm test`).
 *
 * The three files must have exactly the same keys, the same {{placeholders}}
 * and <tags> in each string, and no empty strings; and every key the code
 * uses must exist.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const dir = fileURLToPath(new URL("../src/i18n/locales/", import.meta.url));
const load = (l: string) => JSON.parse(readFileSync(`${dir}${l}.json`, "utf8"));
const en = load("en");
const others = { hi: load("hi"), te: load("te") };

function flatten(o: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, key));
    else out[key] = v as string;
  }
  return out;
}
const flat = { en: flatten(en), hi: flatten(others.hi), te: flatten(others.te) };
const marks = (s: string) => [...(s.match(/\{\{\s*\w+\s*\}\}/g) ?? []), ...(s.match(/<\/?\w+>/g) ?? [])].sort().join(" ");

for (const lang of ["hi", "te"] as const) {
  test(`${lang} has exactly the English keys`, () => {
    const missing = Object.keys(flat.en).filter((k) => !(k in flat[lang]));
    const extra = Object.keys(flat[lang]).filter((k) => !(k in flat.en));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] });
  });
  test(`${lang} keeps every placeholder and tag`, () => {
    const off = Object.keys(flat.en).filter((k) => k in flat[lang] && marks(flat.en[k]) !== marks(flat[lang][k]));
    assert.deepEqual(off, []);
  });
  test(`${lang} is really translated (not English copied over), apart from names`, () => {
    const same = Object.keys(flat.en).filter((k) => flat[lang][k] === flat.en[k] && /[a-z]{3}/.test(flat.en[k].replace(/\{\{\w+\}\}|<\/?\w+>/g, "")));
    // Brand and proper names may stay as they are.
    assert.deepEqual(same.filter((k) => !/nutrition$/.test(k)), []);
  });
}

test("no empty strings in any language", () => {
  for (const [lang, f] of Object.entries(flat)) {
    const empty = Object.entries(f).filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => k);
    assert.deepEqual(empty, [], lang);
  }
});

test("Hindi is in Devanagari and Telugu in Telugu script", () => {
  const hiText = Object.values(flat.hi).join(" ");
  const teText = Object.values(flat.te).join(" ");
  assert.ok((hiText.match(/[ऀ-ॿ]/g) ?? []).length > 500);
  assert.ok((teText.match(/[ఀ-౿]/g) ?? []).length > 500);
  assert.ok(!/[ఀ-౿]/.test(hiText) && !/[ऀ-ॿ]/.test(teText), "scripts mixed up");
});

// Every key the code asks for exists in English.
const src = fileURLToPath(new URL("../src/", import.meta.url));
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = `${d}/${f}`;
    // The games keep their own text helper (also called t) and keys.
    if (statSync(p).isDirectory()) { if (!p.endsWith("/features/games")) walk(p); }
    else if (/\.tsx?$/.test(f)) files.push(p);
  }
};
walk(src.replace(/[\\/]$/, ""));
// Code only: comment lines are left out.
const code = files
  .map((f) => readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n"))
  .join("\n");
const plural = (k: string) => k in flat.en || `${k}_one` in flat.en;

test("every literal key used in the code exists", () => {
  const used = new Set<string>();
  for (const m of code.matchAll(/\bt\(\s*"([a-zA-Z][\w.]+)"/g)) used.add(m[1]);
  for (const m of code.matchAll(/\bi18n\.t\(\s*"([a-zA-Z][\w.]+)"/g)) used.add(m[1]);
  for (const m of code.matchAll(/<T k="([\w.]+)"/g)) used.add(m[1]);
  for (const m of code.matchAll(/i18nKey="([\w.]+)"/g)) used.add(m[1]);
  for (const m of code.matchAll(/\bt\(\s*\w+\s*\?\s*"([\w.]+)"\s*:\s*"([\w.]+)"/g)) { used.add(m[1]); used.add(m[2]); }
  const missing = [...used].filter((k) => k.includes(".") && !plural(k));
  assert.ok(used.size > 150, `only ${used.size} keys found`);
  assert.deepEqual(missing, []);
});

test("every key built from a list exists", () => {
  const expect = [
    ...["features", "tools", "families", "promise"].map((k) => `landing.nav.${k}`),
    ...["feel", "routines", "calm"].flatMap((k) => ["title", "text", "alt"].map((f) => `landing.cards.${k}.${f}`)),
    ...["feelings", "habits", "calm"].flatMap((k) => [`landing.features.${k}.title`, `landing.features.${k}.text`]),
    ...["stigma", "privacy", "caregivers"].flatMap((k) => [`landing.promise.${k}.title`, `landing.promise.${k}.text`]),
    ...["individual", "caregiver", "child"].flatMap((k) => ["title", "login", "signup"].map((f) => `auth.role.${k}.${f}`)),
    ...["none", "individual", "caregiver"].map((k) => `auth.login.subtitle.${k}`),
    ...["none", "individual", "caregiver"].flatMap((k) => [`auth.signup.heading.${k}.title`, `auth.signup.heading.${k}.text`]),
    ...["anxiety", "adhd", "autism", "depression", "ptsd", "pcos_pcod"].flatMap((k) => [`onboarding.areas.${k}.label`, `onboarding.areas.${k}.desc`]),
    ...["reducedSensoryStimulation", "largerText", "readAloud", "simplifiedPresentation"].flatMap((k) => [`onboarding.access.${k}.label`, `onboarding.access.${k}.desc`]),
    ...["moodCheckIn", "routines", "journal", "reminders", "calmSpace", "gamesCorner", "games", "music", "modules", "companion",
      "nutrition", "talkBoard", "stories", "howIFeel", "myRoutines", "myJournal", "mySpaces", "settings", "allMyTools",
      "moreTools", "focusFeelings", "profile", "alerts", "addChild", "joinFamily"].map((k) => `tiles.${k}`),
    ...["focus", "schedule", "feelings", "countdown"].map((k) => `tiles.tool.${k}`),
    ...["breatheReset", "eveningWindDown", "bodyReset"].map((k) => `home.individual.sessions.${k}`),
    ...["breathing", "relaxation", "mindfulness"].map((k) => `home.individual.categories.${k}`),
    ...["closing1", "closing2", "closing3", "closing4"].map((k) => `home.${k}`),
  ];
  assert.deepEqual(expect.filter((k) => !plural(k)), []);
});

test("plural keys have one and other forms in every language", () => {
  for (const [lang, f] of Object.entries(flat)) {
    const ones = Object.keys(f).filter((k) => k.endsWith("_one"));
    const lonely = ones.filter((k) => !(`${k.slice(0, -4)}_other` in f));
    assert.ok(ones.length > 5);
    assert.deepEqual(lonely, [], lang);
  }
});

console.log(`${passed} language checks`);
