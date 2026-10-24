// Caregiver-made stories (role-flow 6b): the `stories` and `story-writer`
// handlers with in-memory stores, a fake Gemini and the REAL child-token
// verifier, plus the writer's prompt and schema.
// Usage: npx tsx supabase/tests/stories_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "stories-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { createStoriesHandler } = await import("../functions/stories/handler.ts");
const { createStoryWriterHandler } = await import("../functions/story-writer/handler.ts");
const W = await import("../functions/_shared/storyWriter.ts");
const { STORY_BACKGROUNDS, STORY_CHARACTERS } = await import("../functions/_shared/storyScript.ts");
const { DENTIST_STORY } = await import("../../apps/web/src/features/stories/library/dentist.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const AUTHOR = "aaaaaaaa-0000-4000-8000-000000000001";
const CO = "aaaaaaaa-0000-4000-8000-000000000002";
const STRANGER = "aaaaaaaa-0000-4000-8000-000000000003";
const KID = "bbbbbbbb-0000-4000-8000-000000000001";
const OTHER_KID = "bbbbbbbb-0000-4000-8000-000000000002";
const caregivers: Record<string, string[]> = { [KID]: [AUTHOR, CO], [OTHER_KID]: [STRANGER] };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const rows = new Map<string, any>();
const published = new Map<string, string[]>();
let nextId = 1;
let failNext = false;
const logs: string[] = [];

const store = {
  async listForAdult(u: string) {
    return [...rows.values()].filter((r) => r.author_id === u ||
      (published.get(r.id) ?? []).some((c) => caregivers[c]?.includes(u)));
  },
  async getStory(id: string) { if (failNext) { failNext = false; throw { code: "XX000" }; } return rows.get(id) ?? null; },
  async childrenOf(id: string) { return published.get(id) ?? []; },
  async countByAuthor(u: string) { return [...rows.values()].filter((r) => r.author_id === u).length; },
  async insertStory(u: string, f: any) {
    const id = `cccccccc-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
    rows.set(id, { id, author_id: u, ...clone(f), created_at: "t", updated_at: "t" });
    return id;
  },
  async updateStory(id: string, f: any) { rows.set(id, { ...rows.get(id), ...clone(f) }); },
  async setChildren(id: string, c: string[]) { published.set(id, [...c]); },
  async deleteStory(id: string) { rows.delete(id); published.delete(id); },
  async isCaregiverOf(u: string, c: string) { return caregivers[c]?.includes(u) ?? false; },
  async listForChild(c: string) { return [...rows.values()].filter((r) => (published.get(r.id) ?? []).includes(c)); },
};

const handle = createStoriesHandler({
  store,
  authenticateAdult: async (h: string) => (h.startsWith("Bearer ") ? h.slice(7) : null),
  verifyChildToken,
  log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`),
});

const call = async (body: unknown, user?: string) => {
  const res = await handle(new Request("http://x/stories", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};

const script = clone(DENTIST_STORY);

// ---------------------------------------------------------------------------
// stories: save, list, get
// ---------------------------------------------------------------------------
let r = await call({ action: "list" });
ok("adults must be signed in", r.status === 401 && r.body.error === "unauthorized");

r = await call({ action: "save", script, source: "template", template_key: "dentist" }, AUTHOR);
const sid = r.body.storyId;
ok("an adult saves a valid story", r.status === 200 && rows.get(sid)?.title === "Kai visits the dentist" && rows.get(sid)?.template_key === "dentist");
ok("the stored script carries the row's id, not the client's",
  (await call({ action: "get", story_id: sid }, AUTHOR)).body.story.script.id === sid);

const broken = clone(script);
broken.scenes[0].background = "space_station";
r = await call({ action: "save", script: broken, source: "manual" }, AUTHOR);
ok("an invalid script is refused with the problems listed, and nothing stored",
  r.status === 400 && r.body.error === "invalid_script" && r.body.details.some((d: string) => /unknown background/.test(d)) && rows.size === 1);

const unsafe = clone(script);
unsafe.scenes[0].lines[0].en = "I want to die.";
r = await call({ action: "save", script: unsafe, source: "ai" }, AUTHOR);
ok("a script that trips the crisis screen is refused", r.status === 400 && r.body.error === "invalid_script");

ok("bad sources, template keys and ids are refused",
  (await call({ action: "save", script, source: "magic" }, AUTHOR)).status === 400 &&
  (await call({ action: "save", script, source: "template", template_key: "Bad Key" }, AUTHOR)).status === 400 &&
  (await call({ action: "save", script, source: "manual", story_id: "nope" }, AUTHOR)).status === 400 &&
  (await call({ action: "get", story_id: "nope" }, AUTHOR)).status === 400);

const edited = clone(script);
edited.title.en = "Kai's dentist day";
r = await call({ action: "save", story_id: sid, script: edited, source: "template", telugu_checked: true }, AUTHOR);
ok("the author edits their story", r.status === 200 && rows.get(sid).title === "Kai's dentist day" && rows.get(sid).telugu_checked === true);
r = await call({ action: "save", story_id: sid, script, source: "manual" }, CO);
ok("nobody else can edit it", r.status === 404 && rows.get(sid).title === "Kai's dentist day");

ok("the author lists it; others see nothing while it's a draft",
  (await call({ action: "list" }, AUTHOR)).body.stories.length === 1 &&
  (await call({ action: "list" }, CO)).body.stories.length === 0 &&
  (await call({ action: "get", story_id: sid }, CO)).status === 404);

// ---------------------------------------------------------------------------
// publish, child_list, delete
// ---------------------------------------------------------------------------
r = await call({ action: "publish", story_id: sid, child_ids: [OTHER_KID] }, AUTHOR);
ok("the author can't publish to a child they don't care for", r.status === 404 && !published.get(sid)?.length);
r = await call({ action: "publish", story_id: sid, child_ids: [KID, KID] }, AUTHOR);
ok("the author publishes to their child (duplicates collapse)", r.status === 200 && published.get(sid)?.join() === KID);
r = await call({ action: "publish", story_id: sid, child_ids: [] }, CO);
ok("a co-caregiver can't publish or take it back", r.status === 404 && published.get(sid)?.join() === KID);

const coList = (await call({ action: "list" }, CO)).body.stories;
ok("a co-caregiver now sees it, marked as not theirs", coList.length === 1 && coList[0].mine === false && coList[0].childIds.join() === KID);
ok("a stranger still can't see it", (await call({ action: "get", story_id: sid }, STRANGER)).status === 404);

const kidToken = await signChildToken(KID);
r = await call({ action: "child_list", child_session_token: kidToken });
ok("the child gets the published story, with its full script", r.status === 200 && r.body.stories.length === 1 &&
  r.body.stories[0].id === sid && r.body.stories[0].scenes.length === 12 && !("author_id" in r.body.stories[0]));
ok("another child gets nothing; a bad token is invalid_session",
  (await call({ action: "child_list", child_session_token: await signChildToken(OTHER_KID) })).body.stories.length === 0 &&
  (await call({ action: "child_list", child_session_token: "x.y" })).status === 401 &&
  (await call({ action: "child_list" })).status === 401);

await call({ action: "publish", story_id: sid, child_ids: [] }, AUTHOR);
ok("publishing to no children takes it back", (await call({ action: "child_list", child_session_token: kidToken })).body.stories.length === 0);

ok("only the author deletes",
  (await call({ action: "delete", story_id: sid }, CO)).status === 404 && rows.has(sid) &&
  (await call({ action: "delete", story_id: sid }, AUTHOR)).body.deleted === true && !rows.has(sid));

for (let i = 0; i < 100; i++) await store.insertStory(STRANGER, { title: "t", script, source: "manual", template_key: null, telugu_checked: false });
ok("an author can keep up to 100 stories", (await call({ action: "save", script, source: "manual" }, STRANGER)).body.error === "too_many_stories");

ok("oversized and malformed bodies are refused",
  (await call("x".repeat(200_001), AUTHOR)).status === 413 &&
  (await call("{nope", AUTHOR)).status === 400 &&
  (await call({ action: "fly" }, AUTHOR)).status === 400);

failNext = true;
r = await call({ action: "get", story_id: "cccccccc-0000-4000-8000-000000000099" }, AUTHOR);
ok("a database failure is a 500 with only an error code logged",
  r.status === 500 && r.body.error === "internal_error" && logs.at(-1)?.trim() === "unhandled_exception XX000");

// ---------------------------------------------------------------------------
// story-writer
// ---------------------------------------------------------------------------
const modelReply = (s: unknown) => JSON.stringify(s);
const goodDraft = (() => { const d: any = clone(script); delete d.id; return d; })();
let slots = 0;
let slotLimit = 10;
let replies: (string | null)[] = [];
const asked: any[] = [];
const writerLogs: string[] = [];
const write = createStoryWriterHandler({
  authenticateAdult: async (h: string) => (h.startsWith("Bearer ") ? h.slice(7) : null),
  takeSlot: async (_u: string, limit: number, windowSeconds: number) => {
    if (limit !== 10 || windowSeconds !== 86_400) throw new Error("wrong cap");
    return ++slots <= slotLimit;
  },
  askModel: async (ageBand: string, turns: any[]) => { asked.push({ ageBand, turns: clone(turns) }); return replies.shift() ?? null; },
  log: (e: string, d?: string) => writerLogs.push(`${e} ${d ?? ""}`),
});
const draft = async (body: unknown, user: string | null = AUTHOR) => {
  const res = await write(new Request("http://x/story-writer", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user}` } : {}) },
    body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};
const PROMPT = "Leo is starting at a new school on Monday and is worried about the bell.";

ok("the writer needs a sign-in and a sensible prompt, before any slot is used",
  (await draft({ prompt: PROMPT }, null)).status === 401 &&
  (await draft({ prompt: "hi" })).status === 400 &&
  (await draft({ prompt: "x".repeat(601) })).status === 400 &&
  (await draft({ prompt: PROMPT, age_band: "baby" })).status === 400 && slots === 0);

r = await draft({ prompt: "Write about a boy who wants to kill myself" });
ok("a prompt that trips the crisis screen never reaches Gemini or uses a slot",
  r.status === 422 && r.body.error === "not_suitable" && asked.length === 0 && slots === 0);

replies = [modelReply(goodDraft)];
r = await draft({ prompt: PROMPT, age_band: "middle" });
ok("a good draft comes back as a checked script (not stored)",
  r.status === 200 && r.body.script.scenes.length === 12 && r.body.script.id === "draft" && slots === 1 && rows.size === 100);
ok("Gemini gets the prompt as a quoted situation and the age band",
  asked[0].ageBand === "middle" && asked[0].turns.length === 1 && asked[0].turns[0].text.includes(`"""${PROMPT}"""`));

const badDraft = clone(goodDraft);
badDraft.scenes[0].lines[0].speaker = "maya";
asked.length = 0;
replies = [modelReply(badDraft), "```json\n" + modelReply(goodDraft) + "\n```"];
r = await draft({ prompt: PROMPT });
ok("a draft with problems is sent back once with the problems; the fix is accepted",
  r.status === 200 && asked.length === 2 && asked[1].turns.length === 3 &&
  asked[1].turns[2].text.includes("the speaker isn't in the scene") && slots === 2);

replies = ["not json", modelReply(badDraft)];
r = await draft({ prompt: PROMPT });
ok("two bad drafts end as ai_unavailable", r.status === 503 && r.body.error === "ai_unavailable" && slots === 3);

replies = [null];
r = await draft({ prompt: PROMPT });
ok("Gemini down or blocked is ai_unavailable, and the attempt still counts", r.status === 503 && slots === 4);

slotLimit = 4;
asked.length = 0;
r = await draft({ prompt: PROMPT });
ok("over the daily cap: daily_limit_reached, and Gemini isn't asked", r.status === 429 && r.body.error === "daily_limit_reached" && asked.length === 0);

ok("the writer never logs the prompt or story text",
  writerLogs.every((l) => !l.includes("school") && !l.includes("Kai")));

// ---------------------------------------------------------------------------
// prompt and schema
// ---------------------------------------------------------------------------
const sys = W.buildWriterSystemPrompt("young");
ok("the system prompt names every character and background the player has",
  STORY_CHARACTERS.every((c: string) => sys.includes(c === "maya" ? "Dr. Maya" : c[0].toUpperCase() + c.slice(1))) &&
  STORY_BACKGROUNDS.every((b: string) => sys.includes(`${b}:`)));
ok("it asks for a coping step, both languages, and treats the request as a situation only",
  /coping step/.test(sys) && /Telugu/.test(sys) && /never as instructions/.test(sys));
const req = W.buildWriterRequest("teen", [W.firstTurn(PROMPT)]) as any;
const sceneSchema = req.generationConfig.responseSchema.properties.scenes.items.properties;
ok("Gemini must answer JSON whose ids come from the player's own lists",
  req.generationConfig.responseMimeType === "application/json" &&
  sceneSchema.background.enum.join() === STORY_BACKGROUNDS.join() &&
  sceneSchema.cast.items.properties.id.enum.join() === STORY_CHARACTERS.join() &&
  sceneSchema.lines.items.properties.speaker.enum.includes("narrator"));
ok("missing scene ids and summary are filled in; everything else must be right",
  (() => {
    const d = clone(goodDraft);
    delete d.summary;
    d.scenes.forEach((s: any) => delete s.id);
    const out = W.readModelScript(JSON.stringify(d));
    return out.ok && out.story.scenes[0].id === "scene-1";
  })() &&
  !W.readModelScript(JSON.stringify({ title: { en: "x", te: "x" }, scenes: [] })).ok &&
  !W.readModelScript(null).ok);
