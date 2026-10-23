// Sprint 3 reminders: the in-app due rule (timezones, weekday, day boundary,
// DST), parity between the Edge Function and api-client implementations,
// request validation, and the child `reminders` handler with an in-memory
// store and the REAL child-token verifier.
// Usage: npx tsx supabase/tests/reminders_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "reminders-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const R = await import("../functions/_shared/reminders.ts");
const { createRemindersHandler } = await import("../functions/reminders/handler.ts");
const client = await import("../../packages/api-client/src/reminders.ts");
const shared = await import("../../packages/shared-types/src/index.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const rem = (over: Partial<any> = {}) => ({
  id: over.id ?? "r1", profileId: "p", childId: null, kind: "water", title: "Water", routineId: null,
  timeOfDay: "09:00", daysOfWeek: [], timezone: "Asia/Kolkata", isEnabled: true, createdAt: "x", updatedAt: "x", ...over,
});

// ---------------------------------------------------------------------------
// Due rule
// ---------------------------------------------------------------------------
// 2026-10-24 is a Saturday. 04:00 UTC = 09:30 IST.
const sat0930ist = new Date("2026-10-24T04:00:00Z");
let due = R.computeDueReminders([rem()], [], sat0930ist);
ok("due once local time passes timeOfDay (09:00 IST at 09:30 IST)",
  due.length === 1 && due[0].occursOn === "2026-10-24" && due[0].dueAt === "2026-10-24T03:30:00.000Z" && !due[0].acknowledged);
ok("not due before the local time (08:59 IST)",
  R.computeDueReminders([rem()], [], new Date("2026-10-24T03:29:00Z")).length === 0);
ok("disabled reminders are never due", R.computeDueReminders([rem({ isEnabled: false })], [], sat0930ist).length === 0);
ok("weekday filter: a weekdays-only reminder isn't due on Saturday",
  R.computeDueReminders([rem({ daysOfWeek: [1, 2, 3, 4, 5] })], [], sat0930ist).length === 0 &&
  R.computeDueReminders([rem({ daysOfWeek: [6] })], [], sat0930ist).length === 1);
// 20:00 UTC Sat = 01:30 IST Sunday; for an IST reminder 'today' is already Sunday.
const late = new Date("2026-10-24T20:00:00Z");
due = R.computeDueReminders([rem({ timeOfDay: "01:00" }), rem({ id: "utc", timezone: "UTC", timeOfDay: "19:00" })], [], late);
ok("each reminder uses ITS OWN timezone for 'today' (IST already Sunday, UTC still Saturday)",
  due.find((d) => d.reminder.id === "r1")?.occursOn === "2026-10-25" && due.find((d) => d.reminder.id === "utc")?.occursOn === "2026-10-24");
ok("acknowledged flag matches reminder + local date",
  R.computeDueReminders([rem()], [{ reminderId: "r1", occursOn: "2026-10-24" }], sat0930ist)[0].acknowledged === true &&
  R.computeDueReminders([rem()], [{ reminderId: "r1", occursOn: "2026-10-23" }], sat0930ist)[0].acknowledged === false);
// New York: EDT (UTC-4) until 2026-11-01 02:00, then EST (UTC-5).
ok("DST-aware dueAt (New York 08:00 is 12:00Z in EDT, 13:00Z in EST)",
  R.zonedTimeToUtc("2026-10-24", "08:00", "America/New_York").toISOString() === "2026-10-24T12:00:00.000Z" &&
  R.zonedTimeToUtc("2026-11-02", "08:00", "America/New_York").toISOString() === "2026-11-02T13:00:00.000Z");
ok("results sorted by dueAt", (() => {
  const d = R.computeDueReminders([rem({ id: "b", timeOfDay: "09:15" }), rem({ id: "a", timeOfDay: "08:00" })], [], sat0930ist);
  return d.map((x) => x.reminder.id).join() === "a,b";
})());
ok("timezone validation", R.isValidTimeZone("Asia/Kolkata") && !R.isValidTimeZone("Mars/Olympus") && !R.isValidTimeZone(""));

// ---------------------------------------------------------------------------
// Parity: Edge Function and api-client implementations agree
// ---------------------------------------------------------------------------
const zones = ["Asia/Kolkata", "UTC", "America/New_York", "Pacific/Auckland"];
const times = ["00:00", "06:45", "12:00", "23:59"];
const days = [[], [0], [1, 2, 3, 4, 5], [6]];
const reminders = zones.flatMap((tz, i) => times.map((t, j) => rem({ id: `r${i}-${j}`, timezone: tz, timeOfDay: t, daysOfWeek: days[(i + j) % 4] })));
const acks = [{ reminderId: "r0-1", occursOn: "2026-10-24" }, { reminderId: "r2-2", occursOn: "2026-11-01" }];
let same = true;
for (let h = 0; h < 24 * 10; h += 7) {
  const at = new Date(Date.UTC(2026, 9, 24, 0, 13) + h * 3_600_000);
  const a = JSON.stringify(R.computeDueReminders(reminders as any, acks, at));
  const b = JSON.stringify(client.computeDueReminders(reminders as any, acks, at));
  if (a !== b) { same = false; break; }
}
ok("computeDueReminders is identical in the Edge Function and the api-client (16 reminders x 35 instants)", same);
ok("reminder kinds in shared-types match the database list",
  JSON.stringify(shared.REMINDER_KINDS) === JSON.stringify(["routine", "water", "medication", "wellness", "custom"]));

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------
const T = { child_session_token: "t" };
const p = (b: unknown) => R.parseRemindersRequest(b);
ok("parse: bad body 400, missing token 401, unknown action 400",
  (p(null) as any).status === 400 && (p({ action: "list" }) as any).status === 401 && (p({ ...T, action: "create" }) as any).error === "invalid_action");
ok("parse: acknowledge needs a UUID and a valid date",
  (p({ ...T, action: "acknowledge", reminder_id: "x", occurs_on: "2026-10-24" }) as any).error === "invalid_input" &&
  (p({ ...T, action: "acknowledge", reminder_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", occurs_on: "2026-02-30" }) as any).error === "invalid_input" &&
  p({ ...T, action: "acknowledge", reminder_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", occurs_on: "2026-10-24" }).ok);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
const CHILD_A = "11111111-1111-4111-8111-111111111111";
const CHILD_B = "22222222-2222-4222-8222-222222222222";
const RA = "aaaaaaaa-0000-4000-8000-00000000000a";
const RB = "bbbbbbbb-0000-4000-8000-00000000000b";
const row = (id: string, child: string, title: string, time: string) => ({
  id, profile_id: null, child_id: child, kind: "water", title, routine_id: null, time_of_day: `${time}:00`,
  days_of_week: [], timezone: "Asia/Kolkata", is_enabled: true, created_at: "x", updated_at: "x",
});
function makeWorld() {
  const acks = new Set<string>();
  const calls: string[] = [];
  const logs: string[] = [];
  const cfg = { fail: false };
  const rows = [row(RA, CHILD_A, "Drink water", "09:00"), row(RB, CHILD_B, "B's reminder", "09:00")];
  const handler = createRemindersHandler({
    store: {
      async listReminders(childId: string) {
        calls.push("list");
        if (cfg.fail) throw Object.assign(new Error("db down: Drink water"), { code: "PGRST301" });
        return rows.filter((r) => r.child_id === childId);
      },
      async listAcknowledgements(ids: string[], from: string, to: string) {
        calls.push(`acks ${from}..${to}`);
        return [...acks].map((k) => k.split("|")).filter(([id, d]) => ids.includes(id) && d >= from && d <= to)
          .map(([reminder_id, occurs_on]) => ({ reminder_id, occurs_on }));
      },
      async childOwnsReminder(childId: string, id: string) { return rows.some((r) => r.id === id && r.child_id === childId); },
      async acknowledge(id: string, d: string) { calls.push("ack"); acks.add(`${id}|${d}`); },
    },
    verifyChildToken,
    log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`),
    now: () => sat0930ist,
  });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/reminders", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text };
  };
  return { call, calls, logs, cfg, acks };
}

const tokA = await signChildToken(CHILD_A);
{
  const w = makeWorld();
  ok("OPTIONS preflight is 200 before any work", (await w.call(null, { method: "OPTIONS" })).status === 200 && w.calls.length === 0);
  ok("tampered or malformed token is 401, never 500",
    (await w.call({ action: "list", child_session_token: `${tokA.split(".")[0]}.AAAA` })).status === 401 &&
    (await w.call({ action: "list", child_session_token: "abc.%%%" })).status === 401 && w.calls.length === 0);
  const list = await w.call({ action: "list", child_session_token: tokA });
  ok("child lists only their own reminders, in the contract shape",
    list.status === 200 && list.json.reminders.length === 1 && list.json.reminders[0].timeOfDay === "09:00" && !list.text.includes("B's"));
  const due = await w.call({ action: "list_due", child_session_token: tokA });
  ok("list_due uses the server clock and returns today's due occurrence",
    due.status === 200 && due.json.due.length === 1 && due.json.due[0].occursOn === "2026-10-24" && due.json.due[0].acknowledged === false);
  const ack = await w.call({ action: "acknowledge", reminder_id: RA, occurs_on: "2026-10-24", child_session_token: tokA });
  const after = await w.call({ action: "list_due", child_session_token: tokA });
  ok("child acknowledges; the occurrence then shows as acknowledged", ack.status === 200 && after.json.due[0].acknowledged === true);
  const other = await w.call({ action: "acknowledge", reminder_id: RB, occurs_on: "2026-10-24", child_session_token: tokA });
  ok("acknowledging another child's reminder is 404 and writes nothing", other.status === 404 && !w.acks.has(`${RB}|2026-10-24`));
  ok("acknowledging far outside the window is 400",
    (await w.call({ action: "acknowledge", reminder_id: RA, occurs_on: "2026-10-01", child_session_token: tokA })).status === 400);
}
{
  const w = makeWorld();
  w.cfg.fail = true;
  const r = await w.call({ action: "list", child_session_token: tokA });
  ok("store failure is 500 with no details, logged with a code only",
    r.status === 500 && !r.text.includes("Drink") && w.logs.length === 1 && w.logs[0] === "unhandled_exception PGRST301");
}
