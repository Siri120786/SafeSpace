// child-settings handler: a signed-in child reads their settings and, at 15 or
// over, sets whether their caregivers see their activity. REAL child-token
// verification, in-memory store standing in for set_child_sharing().
// Usage: npx tsx supabase/tests/child_settings_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "settings-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { createChildSettingsHandler } = await import("../functions/child-settings/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const NOW = new Date("2026-10-23T12:00:00Z");
const KID = "11111111-1111-4111-8111-111111111111";      // born Oct 2016: 10
const TEEN = "22222222-2222-4222-8222-222222222222";     // born Oct 2010: 16
const TURNING = "33333333-3333-4333-8333-333333333333";  // born Nov 2011: 14 until 1 Nov 2026

function makeWorld() {
  const rows: Record<string, { birth_year: number; birth_month: number; shares_with_caregiver: boolean | null; sharing_decided_at: string | null; preferred_language?: string | null }> = {
    [KID]: { birth_year: 2016, birth_month: 10, shares_with_caregiver: null, sharing_decided_at: null },
    [TEEN]: { birth_year: 2010, birth_month: 10, shares_with_caregiver: null, sharing_decided_at: null },
    [TURNING]: { birth_year: 2011, birth_month: 11, shares_with_caregiver: null, sharing_decided_at: null },
  };
  const calls: string[] = [];
  const logs: string[] = [];
  const fail = { set: false };
  const locked = new Set<string>();
  const handler = createChildSettingsHandler({
    store: {
      async getChild(id) { calls.push(`get ${id}`); return rows[id] ?? null; },
      async setSharing(id, share) {
        calls.push(`set ${id} ${share}`);
        if (fail.set) throw Object.assign(new Error("db down"), { code: "PGRST301" });
        rows[id].shares_with_caregiver = share;
        rows[id].sharing_decided_at = NOW.toISOString();
      },
      async setTheme(id, theme) {
        calls.push(`theme ${id} ${theme}`);
        if (locked.has(id)) throw new Error("theme_locked");
      },
      async setLanguage(id, language) {
        calls.push(`language ${id} ${language}`);
        rows[id].preferred_language = language;
      },
    },
    verifyChildToken,
    log: (e, d) => logs.push(`${e} ${d ?? ""}`),
    now: () => NOW,
  });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/child-settings", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text };
  };
  return { call, calls, logs, fail, rows, locked };
}

const tKid = await signChildToken(KID);
const tTeen = await signChildToken(TEEN);
const tTurning = await signChildToken(TURNING);

{
  const w = makeWorld();
  ok("OPTIONS is 200; GET is 405", (await w.call(null, { method: "OPTIONS" })).status === 200 && (await w.call(null, { method: "GET" })).status === 405);
  ok("bad JSON 400, unknown action 400, missing token 401",
    (await w.call(null, { raw: "{x" })).status === 400 &&
    (await w.call({ action: "delete", child_session_token: tKid })).json.error === "invalid_action" &&
    (await w.call({ action: "get" })).status === 401);
  ok("a tampered token is 401 and reads nothing",
    (await w.call({ action: "get", child_session_token: `${tKid.split(".")[0]}.AAAA` })).status === 401 && w.calls.length === 0);

  const kid = await w.call({ action: "get", child_session_token: tKid });
  ok("a 10-year-old's settings: under_15, can't change sharing",
    kid.status === 200 && kid.json.settings.ageYears === 10 && kid.json.settings.sharing === "under_15" && kid.json.settings.canChangeSharing === false);
  const teen = await w.call({ action: "get", child_session_token: tTeen });
  ok("a 16-year-old who hasn't chosen: not_asked, can change it",
    teen.json.settings.ageYears === 16 && teen.json.settings.sharing === "not_asked" && teen.json.settings.canChangeSharing === true);
  ok("a child who turns 15 next month is still under_15 today",
    (await w.call({ action: "get", child_session_token: tTurning })).json.settings.sharing === "under_15");
}
{
  const w = makeWorld();
  const under = await w.call({ action: "set_sharing", share: false, child_session_token: tKid });
  ok("under 15, setting the choice is refused and nothing is written",
    under.status === 400 && under.json.error === "sharing_not_available_under_15" && !w.calls.some((c) => c.startsWith("set")));
  ok("share must be a boolean", (await w.call({ action: "set_sharing", share: "no", child_session_token: tTeen })).json.error === "invalid_input");
  const off = await w.call({ action: "set_sharing", share: false, child_session_token: tTeen });
  ok("a 16-year-old chooses not to share", off.status === 200 && off.json.settings.sharing === "not_shared" &&
    off.json.settings.sharingDecidedAt === NOW.toISOString());
  const on = await w.call({ action: "set_sharing", share: true, child_session_token: tTeen });
  ok("...and can change their mind", on.json.settings.sharing === "shared");
  ok("only the token's own child is ever touched", w.calls.every((c) => c.includes(TEEN) || c.includes(KID)) &&
    w.rows[TURNING].shares_with_caregiver === null);
}
{
  const w = makeWorld();
  w.fail.set = true;
  const r = await w.call({ action: "set_sharing", share: false, child_session_token: tTeen });
  ok("a store failure is 500 with nothing leaked, logged by code only",
    r.status === 500 && !r.text.includes("db down") && w.logs.length === 1 && w.logs[0] === "unhandled_exception PGRST301");
}
{
  const w = makeWorld();
  const r = await w.call({ action: "set_theme", theme: "space", child_session_token: tKid });
  ok("a child picks their own theme", r.status === 200 && r.json.theme === "space" && w.calls.includes(`theme ${KID} space`));
  ok("only the seven themes, checked before the database",
    (await w.call({ action: "set_theme", theme: "pirates", child_session_token: tKid })).json.error === "invalid_input" &&
    (await w.call({ action: "set_theme", child_session_token: tKid })).json.error === "invalid_input" &&
    !w.calls.some((c) => c.includes("pirates")));
  ok("a bad token picks nothing",
    (await w.call({ action: "set_theme", theme: "ocean", child_session_token: "nope" })).status === 401 &&
    !w.calls.some((c) => c.includes("ocean")));
  w.locked.add(KID);
  const l = await w.call({ action: "set_theme", theme: "ocean", child_session_token: tKid });
  ok("a locked theme is refused with theme_locked (409), not logged as a failure",
    l.status === 409 && l.json.error === "theme_locked" && w.logs.length === 0);
}

// Language (migration 20261031200000): a child's own English, Hindi or Telugu.
{
  const w = makeWorld();
  ok("get: no language chosen yet reads as null", (await w.call({ action: "get", child_session_token: tKid })).json.settings.language === null);
  const set = await w.call({ action: "set_language", language: "te", child_session_token: tKid });
  ok("set_language saves the token's child's choice", set.status === 200 && set.json.language === "te" && w.calls.includes(`language ${KID} te`));
  ok("get then returns it", (await w.call({ action: "get", child_session_token: tKid })).json.settings.language === "te");
  ok("only en, hi and te, checked before the database",
    (await w.call({ action: "set_language", language: "fr", child_session_token: tKid })).json.error === "invalid_input" &&
    (await w.call({ action: "set_language", child_session_token: tKid })).json.error === "invalid_input" &&
    !w.calls.some((c) => c.includes("fr")));
  ok("a bad token changes nothing", (await w.call({ action: "set_language", language: "hi", child_session_token: "nope" })).status === 401 &&
    !w.calls.some((c) => c.includes(" hi")));
}
