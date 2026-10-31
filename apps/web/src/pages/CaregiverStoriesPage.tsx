import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  deleteStory,
  draftStoryWithAi,
  getStory,
  listMyChildren,
  listStories,
  publishStory,
  saveStory,
  type StoryAgeBand,
  type StorySummary,
} from "@safespace/api-client";
import type { Child } from "@safespace/shared-types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CaregiverPageShell, ConfirmButton } from "../features/caregiver";
import {
  AGE_BAND_LABELS,
  AI_PROMPT_MAX,
  AI_PROMPT_MIN,
  STORY_TEMPLATES,
  VIDEO_STORIES,
  VideoStoryCard,
  VideoStoryPlayer,
  aiDraftErrorText,
  StoryEditor,
  StoryPlayer,
  estimateStorySeconds,
  findTemplate,
  scriptFromTemplate,
  singleScene,
  storyErrorText,
  validateStory,
  type Story,
} from "../features/stories";
import { ROUTES } from "../routes";

const storyPath = (id: string) => `${ROUTES.CAREGIVER_STORIES}/${encodeURIComponent(id)}`;
// Overrides the global `input { width: 100% }` for checkboxes.
const checkbox = "h-4 w-4 shrink-0 p-0 accent-deepGreen";
const minutes = (s: Story) => Math.max(1, Math.round(estimateStorySeconds(s, "en") / 60));

function useMyChildren() {
  const [children, setChildren] = useState<Child[]>([]);
  useEffect(() => {
    listMyChildren().then(setChildren).catch(() => setChildren([]));
  }, []);
  return children;
}

const namesOf = (ids: string[], kids: Child[]) =>
  ids.map((id) => kids.find((k) => k.id === id)?.name).filter(Boolean).join(", ");

// /caregiver/stories: the caregiver's stories, and templates to start a new one.
export const CaregiverStoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const kids = useMyChildren();
  const [stories, setStories] = useState<StorySummary[] | null>(null);
  const [error, setError] = useState(false);
  const [watching, setWatching] = useState<string | null>(null);
  const watched = VIDEO_STORIES.find((v) => v.id === watching) ?? null;

  useEffect(() => {
    listStories().then(setStories).catch(() => setError(true));
  }, []);

  return (
    <CaregiverPageShell title="Stories" subtitle="Animated social stories for your children. Start from a template, change anything, then publish." backTo={ROUTES.CAREGIVER_HOME}>
      <Card>
        <h2 className="font-display text-xl font-medium text-textHeading">Your stories</h2>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">Couldn't load your stories right now.</p>}
        {!error && stories === null && <p className="mt-3 text-sm text-textBody">Loading...</p>}
        {stories?.length === 0 && <p className="mt-3 text-sm text-textBody">No stories yet. Pick a template below to make the first one.</p>}
        {!!stories?.length && (
          <ul className="mt-3 divide-y divide-olive-100">
            {stories.map((s) => (
              <li key={s.id}>
                <Link to={storyPath(s.id)} className="flex items-center justify-between gap-3 py-3 hover:bg-olive-50/50 rounded-xl px-2">
                  <span>
                    <span className="block font-medium text-textHeading">{s.title}</span>
                    <span className="block text-xs text-textMuted">
                      {s.childIds.length ? `Published to ${namesOf(s.childIds, kids) || `${s.childIds.length} children`}` : "Draft: no child sees it yet"}
                      {" · "}{s.scenes} scenes{s.mine ? "" : " · made by another caregiver"}
                      {!s.teluguChecked && " · Telugu not checked"}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-textMuted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-xl font-medium text-textHeading">Video stories in the library</h2>
        <p className="mt-1 text-sm text-textBody">Every child can watch these on their Stories page. Watch one here first if you like.</p>
        {watched && (
          <div className="mt-4">
            <h3 className="mb-2 font-medium text-textHeading">{watched.title}</h3>
            <VideoStoryPlayer key={watched.id} story={watched} onExit={() => setWatching(null)} />
          </div>
        )}
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {VIDEO_STORIES.map((v) => <VideoStoryCard key={v.id} story={v} onOpen={() => setWatching(v.id)} />)}
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-xl font-medium text-textHeading">Start a new story</h2>
        <p className="mt-1 text-sm text-textBody">Each one has a calm step for hard moments, like slow breathing or raising a hand for a break.</p>
        <button
          type="button"
          onClick={() => navigate(`${ROUTES.CAREGIVER_STORY_NEW}?ai=1`)}
          className="mt-4 w-full text-left rounded-2xl border border-olive-200 bg-paleLime/40 p-4 hover:bg-paleLime/70 focus:outline-none focus:ring-2 focus:ring-olive-500"
        >
          <span aria-hidden="true" className="text-2xl">✨</span>
          <span className="block font-medium text-textHeading">Describe your own</span>
          <span className="block text-xs text-textMuted">Tell us the situation and the story writer drafts it for you to check and change. Up to 10 drafts a day.</span>
        </button>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-textMuted">Or start from a template</p>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {STORY_TEMPLATES.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => navigate(`${ROUTES.CAREGIVER_STORY_NEW}?template=${t.key}`)}
                className="w-full h-full text-left rounded-2xl border border-olive-100 bg-cream/40 p-4 hover:bg-cream focus:outline-none focus:ring-2 focus:ring-olive-500"
              >
                <span aria-hidden="true" className="text-2xl">{t.emoji}</span>
                <span className="block font-medium text-textHeading">{t.title.en}</span>
                <span className="block text-xs text-textMuted">{t.blurb} About {minutes(t.script)} min.</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </CaregiverPageShell>
  );
};

interface Draft {
  storyId: string | null;
  script: Story;
  source: "template" | "ai" | "manual";
  templateKey: string | null;
  teluguChecked: boolean;
  mine: boolean;
  childIds: string[]; // as published
}

// /caregiver/stories/new?template=… and /caregiver/stories/:storyId
export const CaregiverStoryEditorPage: React.FC = () => {
  const { storyId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kids = useMyChildren();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ story: Story; run: number } | null>(null);
  const [previewStill, setPreviewStill] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const aiMode = !storyId && params.get("ai") === "1";

  useEffect(() => {
    setLoadError(null);
    if (aiMode) { setDraft(null); return; }
    if (!storyId) {
      const t = findTemplate(params.get("template"));
      if (!t) { setLoadError("no_template"); return; }
      setDraft({ storyId: null, script: scriptFromTemplate(t), source: "template", templateKey: t.key, teluguChecked: false, mine: true, childIds: [] });
      setPick([]);
      setDirty(true);
      return;
    }
    getStory<Story>(storyId)
      .then((s) => {
        setDraft({ storyId: s.id, script: s.script, source: s.source, templateKey: s.templateKey, teluguChecked: s.teluguChecked, mine: s.mine, childIds: s.childIds });
        setPick(s.childIds);
        setDirty(false);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "error"));
  }, [storyId, params, aiMode]);

  const problems = useMemo(() => (draft ? validateStory({ ...draft.script, id: draft.storyId ?? "new" }) : []), [draft]);

  if (loadError) {
    return (
      <CaregiverPageShell title="Stories" backTo={ROUTES.CAREGIVER_STORIES} backLabel="Back to stories">
        <Card>
          <p className="text-textBody">
            {loadError === "no_template" ? "Pick a template to start from." : loadError === "not_found" ? "This story isn't one you can see, or it was deleted." : "Couldn't load this story right now."}
          </p>
        </Card>
      </CaregiverPageShell>
    );
  }
  if (!draft && aiMode) {
    return (
      <CaregiverPageShell title="Describe your own story" subtitle="The story writer drafts it; you check and change it before any child sees it." backTo={ROUTES.CAREGIVER_STORIES} backLabel="Back to stories">
        <AiDraftForm
          onDraft={(script) => {
            setDraft({ storyId: null, script, source: "ai", templateKey: null, teluguChecked: false, mine: true, childIds: [] });
            setPick([]);
            setDirty(true);
          }}
        />
      </CaregiverPageShell>
    );
  }
  if (!draft) {
    return (
      <CaregiverPageShell title="Story" backTo={ROUTES.CAREGIVER_STORIES} backLabel="Back to stories">
        <p className="text-textBody">Loading...</p>
      </CaregiverPageShell>
    );
  }

  const readOnly = !draft.mine;
  const edit = (script: Story) => { setDraft({ ...draft, script }); setDirty(true); setMessage(null); };
  const show = (story: Story) => { setPreview({ story, run: (preview?.run ?? 0) + 1 }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // Saves if needed; returns the story id.
  const save = async (): Promise<string | null> => {
    if (problems.length) { setMessage({ ok: false, text: "Fix the items in the list first." }); return null; }
    if (!dirty && draft.storyId) return draft.storyId;
    const id = await saveStory({ storyId: draft.storyId ?? undefined, script: draft.script, source: draft.source, templateKey: draft.templateKey, teluguChecked: draft.teluguChecked });
    setDraft((d) => (d ? { ...d, storyId: id } : d));
    setDirty(false);
    if (!draft.storyId) navigate(storyPath(id), { replace: true });
    return id;
  };

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ ok: true, text });
    } catch (e) {
      setMessage({ ok: false, text: storyErrorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const onSave = () => run(async () => ((await save()) ? "Saved." : undefined));
  const onPublish = () => run(async () => {
    const id = await save();
    if (!id) return;
    const ids = await publishStory(id, pick);
    setDraft((d) => (d ? { ...d, storyId: id, childIds: ids } : d));
    return ids.length ? `Published to ${namesOf(ids, kids)}.` : "Taken back: no child sees it now.";
  });
  const onDelete = () => run(async () => {
    if (draft.storyId) await deleteStory(draft.storyId);
    navigate(ROUTES.CAREGIVER_STORIES, { replace: true });
  });

  const publishedChanged = pick.length !== draft.childIds.length || pick.some((id) => !draft.childIds.includes(id));

  return (
    <CaregiverPageShell
      title={draft.script.title.en || "Untitled story"}
      subtitle={`${draft.storyId ? (draft.childIds.length ? `Published to ${namesOf(draft.childIds, kids)}` : "Draft") : "New story, not saved yet"} · about ${minutes(draft.script)} min${readOnly ? " · made by another caregiver (view only)" : ""}`}
      backTo={ROUTES.CAREGIVER_STORIES}
      backLabel="Back to stories"
    >
      <Card className="!p-4 sm:!p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="olive" onClick={() => show(draft.script)}>▶ Preview the whole story</Button>
          {preview && <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Close preview</Button>}
          <label className="mt-0 ml-auto inline-flex items-center gap-2 text-xs text-charcoal">
            <input type="checkbox" className={checkbox} checked={previewStill} onChange={(e) => setPreviewStill(e.target.checked)} />
            Preview in low-sensory mode
          </label>
        </div>
        {preview && (
          <div className="mt-4">
            <StoryPlayer key={`${preview.run}-${previewStill}`} story={preview.story} lowSensory={previewStill} onExit={() => setPreview(null)} />
          </div>
        )}
      </Card>

      {!readOnly && (
        <Card className="!p-4 sm:!p-5 space-y-3">
          {problems.length > 0 ? (
            <div role="status">
              <p className="text-sm font-semibold text-red-700">To fix before saving:</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
                {problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-deepGreen">Everything looks ready.</p>
          )}
          <label className="mt-0 flex items-start gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              className={`${checkbox} mt-1`}
              checked={draft.teluguChecked}
              onChange={(e) => { setDraft({ ...draft, teluguChecked: e.target.checked }); setDirty(true); }}
            />
            <span>
              I've read the Telugu lines and they're right.
              {!draft.teluguChecked && <span className="block text-xs text-textMuted">The Telugu in templates is a first draft. Please read it (or ask someone who speaks Telugu) before your child watches it in Telugu.</span>}
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onSave} disabled={busy || problems.length > 0 || (!dirty && !!draft.storyId)}>
              {draft.storyId ? (dirty ? "Save changes" : "Saved") : "Save as draft"}
            </Button>
            {dirty && draft.storyId && <span className="text-xs text-textMuted">Unsaved changes</span>}
            {message && <span role="status" className={`text-sm ${message.ok ? "text-deepGreen" : "text-red-700"}`}>{message.text}</span>}
          </div>
        </Card>
      )}

      <StoryEditor story={draft.script} onChange={edit} readOnly={readOnly} onPreviewScene={(i) => show(singleScene(draft.script, i))} />

      {!readOnly && (
        <Card className="!p-4 sm:!p-5 space-y-3">
          <h2 className="font-display text-xl font-medium text-textHeading">Who can watch it</h2>
          {kids.length === 0 ? (
            <p className="text-sm text-textBody">Add a child first, then you can publish stories to them.</p>
          ) : (
            <>
              <p className="text-sm text-textBody">Only the children you tick see this story, in their Stories. Their other caregivers can see it too.</p>
              <div className="flex flex-wrap gap-3">
                {kids.map((k) => (
                  <label key={k.id} className="mt-0 inline-flex items-center gap-2 rounded-full border border-olive-200 bg-white px-3 py-1.5 text-sm text-charcoal">
                    <input type="checkbox" className={checkbox} checked={pick.includes(k.id)} onChange={(e) => setPick(e.target.checked ? [...pick, k.id] : pick.filter((id) => id !== k.id))} />
                    {k.name}
                  </label>
                ))}
              </div>
              <Button size="sm" variant="olive" onClick={onPublish} disabled={busy || problems.length > 0 || (!publishedChanged && !dirty)}>
                {pick.length ? (dirty ? "Save and publish" : "Publish") : draft.childIds.length ? "Take it back from everyone" : "Publish"}
              </Button>
            </>
          )}
        </Card>
      )}

      {!readOnly && draft.storyId && (
        <div className="text-right">
          <ConfirmButton label="Delete this story" confirmLabel="Yes, delete it for everyone" onConfirm={onDelete} disabled={busy} />
        </div>
      )}
    </CaregiverPageShell>
  );
};

// Gemini drafts a script (story-writer); the editor opens with it.
const AiDraftForm: React.FC<{ onDraft: (s: Story) => void }> = ({ onDraft }) => {
  const [prompt, setPrompt] = useState("");
  const [ageBand, setAgeBand] = useState<StoryAgeBand>("young");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = prompt.trim().length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const script = await draftStoryWithAi<Story>(prompt.trim(), ageBand);
      const problems = validateStory(script);
      if (problems.length) throw new Error("ai_unavailable");
      onDraft(script);
    } catch (err) {
      setError(aiDraftErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <label className="mt-0 block text-sm font-semibold text-charcoal">
          What's the situation?
          <textarea
            className="mt-1.5 w-full min-h-[7rem] rounded-2xl border border-olive-200 bg-white px-3 py-2 text-sm text-textHeading focus:outline-none focus:ring-2 focus:ring-olive-500"
            value={prompt}
            maxLength={AI_PROMPT_MAX}
            placeholder="For example: We're going on a train to visit Grandma. It will be busy and noisy, and the trip takes three hours."
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <p className="text-xs text-textMuted">
          Kai is the hero of every story, so you don't need your child's name. Please leave out names, places and other private details. {length}/{AI_PROMPT_MAX}
        </p>
        <label className="mt-0 block max-w-xs text-sm font-semibold text-charcoal">
          Your child's age
          <select
            className="mt-1.5 w-full rounded-2xl border border-olive-200 bg-white px-3 py-2 text-sm text-textHeading"
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value as StoryAgeBand)}
          >
            {(Object.keys(AGE_BAND_LABELS) as StoryAgeBand[]).map((b) => <option key={b} value={b}>{AGE_BAND_LABELS[b]}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" variant="olive" disabled={busy || length < AI_PROMPT_MIN}>
            {busy ? "Writing a draft…" : "Write a draft"}
          </Button>
          {busy && <span role="status" className="text-sm text-textBody">This can take up to a minute.</span>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-xs text-textMuted">
          The draft is written by AI. Read every line before you publish it, especially the Telugu. You can change anything.
        </p>
      </form>
    </Card>
  );
};
