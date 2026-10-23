// create-child handler: authentication, caregiver-only access, field
// validation, the caregiver id coming from the verified JWT (never the body),
// the per-family PIN uniqueness check, and content-free failures. Uses the
// REAL PIN hashing with an in-memory store standing in for create_child()
// (migration 20261026200000).
// Usage: npx tsx supabase/tests/create_child_handler.test.mts

const { hashPin, verifyPin } = await import("../functions/_shared/pin.ts");
const { createCreateChildHandler, CreateChildRejected } = await import("../functions/create-child/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const CG_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const CG_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const ADULT = "cccccccc-0000-4000-8000-00000000000c";
const TOKENS: Record<string, string> = { "Bearer a": CG_A, "Bearer b": CG_B, "Bearer adult": ADULT };

type Child = { id: string; caregiverId: string; name: string; age: number; pinHash: string; modules: string[] };
function makeWorld() {
  const children: Child[] = [];
  const calls: string[] = [];
  const logs: string[] = [];
  const fail: { create?: Error } = {};
  const handler = createCreateChildHandler({
    store: {
      async isCaregiver(id) { calls.push(`isCaregiver ${id}`); return id === CG_A || id === CG_B; },
      async listSiblingPinHashes(id) {
        calls.push(`siblings ${id}`);
        return children.filter((c) => c.caregiverId === id).map((c) => c.pinHash);
      },
      async createChild(input) {
        calls.push(`create ${input.caregiverId}`);
        if (fail.create) throw fail.create;
        const id = `child-${children.length + 1}`;
        children.push({ id, ...input });
        return id;
      },
    },
    getUserId: async (auth) => TOKENS[auth] ?? null,
    hashPin,
    verifyPin,
    log: (e, d) => logs.push(`${e} ${d ?? ""}`),
    now: () => new Date("2026-10-23T12:00:00Z"),
  });
  const call = async (body: unknown, opts: { auth?: string | null; raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = opts.auth === undefined ? "Bearer a" : opts.auth;
    if (auth) headers.Authorization = auth;
    const res = await handler(new Request("http://localhost/functions/v1/create-child", {
      method, headers, body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text };
  };
  return { call, calls, logs, fail, children };
}

const valid = { name: "Asha", birthYear: 2016, birthMonth: 3, pin: "4826", modules: ["anxiety", "adhd"] };

// ---------------------------------------------------------------------------
// Authentication and authorization
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  ok("OPTIONS preflight is 200; GET is 405",
    (await w.call(null, { method: "OPTIONS" })).status === 200 && (await w.call(null, { method: "GET" })).status === 405);
  const noAuth = await w.call(valid, { auth: null });
  const badAuth = await w.call(valid, { auth: "Bearer forged" });
  ok("no or invalid JWT is 401 and touches no data",
    noAuth.status === 401 && badAuth.status === 401 && w.calls.length === 0);
  const adult = await w.call(valid, { auth: "Bearer adult" });
  ok("a signed-in non-caregiver gets 403 not_a_caregiver and creates nothing",
    adult.status === 403 && adult.json.error === "not_a_caregiver" && w.children.length === 0 &&
    !w.calls.some((c) => c.startsWith("create")));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const bad = [
    await w.call(null, { raw: "{not json" }),
    await w.call({ ...valid, name: undefined }),
    await w.call({ ...valid, name: "   " }),
    await w.call({ ...valid, name: 42 }),
    await w.call({ ...valid, name: "x".repeat(81) }),
    await w.call({ ...valid, birthYear: 2023 }),                   // age 3
    await w.call({ ...valid, birthYear: 2008, birthMonth: 10 }),   // age 18
    await w.call({ ...valid, birthYear: 2026, birthMonth: 11 }),   // future
    await w.call({ ...valid, birthMonth: 13 }),
    await w.call({ ...valid, birthMonth: undefined }),             // year without month
    await w.call({ ...valid, birthYear: "2016" }),
    await w.call({ name: "Asha", pin: "4826", modules: [] }),     // no birth date or age
    await w.call({ ...valid, pin: "482" }),
    await w.call({ ...valid, pin: 4826 }),
    await w.call({ ...valid, pin: "48a6" }),
  ];
  ok("malformed fields are 400 invalid_request", bad.every((r) => r.status === 400 && r.json.error === "invalid_request"));
  ok("oversized body is 413", (await w.call({ ...valid, name: "y".repeat(3000) })).status === 413);
  ok("invalid requests create nothing", w.children.length === 0 && !w.calls.some((c) => c.startsWith("create")));
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const r = await w.call({ ...valid, name: "  Asha  ", modules: ["anxiety", "adhd", "anxiety", "made_up", 7] });
  const c = w.children[0];
  ok("an authorised caregiver creates a child", r.status === 200 && r.json.child_id === "child-1" && w.children.length === 1);
  ok("the birth month and year are passed through as given", c.birthYear === 2016 && c.birthMonth === 3);
ok("name is trimmed; modules are de-duplicated and unknown keys dropped",
    c.name === "Asha" && c.modules.join() === "anxiety,adhd");
  ok("the PIN is stored only as a PBKDF2 hash that verifies", c.pinHash.startsWith("pbkdf2$100000$") &&
    !c.pinHash.includes("4826") && (await verifyPin("4826", c.pinHash)));

  const spoof = await w.call({ ...valid, pin: "5937", caregiver_id: CG_B, caregiverId: CG_B }, { auth: "Bearer a" });
  ok("a caregiver can't create a child for another caregiver: the body's caregiver id is ignored",
    spoof.status === 200 && w.children[1].caregiverId === CG_A && !w.children.some((x) => x.caregiverId === CG_B));

  const dup = await w.call({ ...valid, name: "Twin" });
  ok("a PIN already used in the family is 409 and creates nothing",
    dup.status === 409 && dup.json.error === "pin_already_used_in_family" && w.children.length === 2);
  ok("the sibling check only looks at the caller's own family", w.calls.filter((x) => x.startsWith("siblings")).every((x) => x === `siblings ${CG_A}`));
  ok("another family may use the same PIN", (await w.call(valid, { auth: "Bearer b" })).status === 200 &&
    w.children[2].caregiverId === CG_B);
}

// ---------------------------------------------------------------------------
// Database rejections and failures
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  w.fail.create = new CreateChildRejected("invalid_input");
  ok("create_child() invalid_input is 400", (await w.call(valid)).status === 400);
  w.fail.create = new CreateChildRejected("not_a_caregiver");
  ok("create_child() not_a_caregiver is 403", (await w.call(valid)).status === 403);
  w.fail.create = Object.assign(new Error("permission denied for table children"), { code: "42501" });
  const r = await w.call(valid);
  ok("any other failure is 500 create_failed, with no error text leaked or logged",
    r.status === 500 && r.json.error === "create_failed" && !r.text.includes("permission") &&
    w.logs.length === 1 && w.logs[0] === "unhandled_exception 42501");
}

// ---------------------------------------------------------------------------
// Legacy input: age in years (still accepted during the transition)
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const r = await w.call({ name: "Old app", age: 9, pin: "4826", modules: [] });
  ok("an age is turned into an approximate birth month/year (October 2017 on 23 Oct 2026)",
    r.status === 200 && w.children[0].birthYear === 2017 && w.children[0].birthMonth === 10);
  ok("legacy ages outside 4 to 17 are refused",
    (await w.call({ name: "x", age: 3, pin: "4826", modules: [] })).status === 400 &&
    (await w.call({ name: "x", age: 18, pin: "4826", modules: [] })).status === 400 &&
    (await w.call({ name: "x", age: 9.5, pin: "4826", modules: [] })).status === 400);
}
