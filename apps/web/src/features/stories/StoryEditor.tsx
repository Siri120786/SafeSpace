import React from "react";
import {
  ACTION_LABELS,
  BACKGROUND_LABELS,
  EFFECT_LABELS,
  PROP_LABELS,
  SLOT_LABELS,
  addCast,
  addLine,
  addScene,
  characterLabel,
  freeCharacters,
  moveScene,
  removeCast,
  removeLine,
  removeScene,
  updateCast,
  updateLine,
  updateScene,
} from "./editor";
import {
  STORY_ACTIONS,
  STORY_BACKGROUNDS,
  STORY_EFFECTS,
  STORY_EXPRESSIONS,
  STORY_LIMITS,
  STORY_PROPS,
  STORY_SLOTS,
  type Story,
  type StoryCharacterId,
  type StoryScene,
  type StoryShot,
} from "./storyScript";

// The caregiver's story editor (role-flow 6b): title, then each scene's place,
// camera, effect, who is in it and what they say, in English and Telugu.
// Controlled: the page owns the script and saves it.

const field =
  "mt-1 w-full rounded-xl border border-olive-200 bg-white px-2.5 py-1.5 text-sm text-textHeading focus:outline-none focus:ring-2 focus:ring-olive-500";
// Overrides the global label style (muted colour, top margin).
const labelClass = "block mt-0 text-xs font-semibold text-charcoal";
const smallBtn =
  "rounded-full border border-olive-200 bg-white px-3 py-1 text-xs font-semibold text-textHeading hover:bg-olive-50 disabled:opacity-40";

const FACE_LABELS = { calm: "Calm", happy: "Happy", worried: "Worried", surprised: "Surprised" } as const;
const SHOT_LABELS: Record<StoryShot, string> = { wide: "The whole room", medium: "Closer on…", close: "Very close on…" };

const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }> = ({
  label, value, onChange, children, disabled,
}) => (
  <label className={labelClass}>
    {label}
    <select className={field} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  </label>
);

const TextArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; lang: "en" | "te"; disabled?: boolean }> = ({
  label, value, onChange, lang, disabled,
}) => (
  <label className={labelClass}>
    {label}
    <textarea
      className={`${field} min-h-[2.75rem] resize-y`}
      lang={lang}
      rows={2}
      value={value}
      disabled={disabled}
      maxLength={STORY_LIMITS.lineChars}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);

interface Props {
  story: Story;
  onChange: (s: Story) => void;
  onPreviewScene: (i: number) => void;
  readOnly?: boolean;
}

export const StoryEditor: React.FC<Props> = ({ story, onChange, onPreviewScene, readOnly }) => {
  const setTitle = (lang: "en" | "te", v: string) => onChange({ ...story, title: { ...story.title, [lang]: v } });
  const setSummary = (lang: "en" | "te", v: string) => onChange({ ...story, summary: { ...story.summary, [lang]: v } });

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-4 sm:p-5 shadow-card space-y-3">
        <h2 className="font-display text-lg font-medium text-textHeading">Title</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            English
            <input className={field} value={story.title.en} maxLength={STORY_LIMITS.titleChars} disabled={readOnly} onChange={(e) => setTitle("en", e.target.value)} />
          </label>
          <label className={labelClass}>
            తెలుగు
            <input className={field} lang="te" value={story.title.te} maxLength={STORY_LIMITS.titleChars} disabled={readOnly} onChange={(e) => setTitle("te", e.target.value)} />
          </label>
          <label className={labelClass}>
            What it's about (English)
            <input className={field} value={story.summary.en} maxLength={160} disabled={readOnly} onChange={(e) => setSummary("en", e.target.value)} />
          </label>
          <label className={labelClass}>
            What it's about (తెలుగు)
            <input className={field} lang="te" value={story.summary.te} maxLength={160} disabled={readOnly} onChange={(e) => setSummary("te", e.target.value)} />
          </label>
        </div>
      </section>

      {story.scenes.map((scene, i) => (
        <SceneCard
          key={`${scene.id}-${i}`}
          scene={scene}
          index={i}
          count={story.scenes.length}
          readOnly={readOnly}
          onChange={(change) => onChange(updateScene(story, i, change))}
          onMove={(by) => onChange(moveScene(story, i, by))}
          onRemove={() => onChange(removeScene(story, i))}
          onAddAfter={() => onChange(addScene(story, i))}
          onPreview={() => onPreviewScene(i)}
        />
      ))}
    </div>
  );
};

const SceneCard: React.FC<{
  scene: StoryScene;
  index: number;
  count: number;
  readOnly?: boolean;
  onChange: (change: (s: StoryScene) => StoryScene) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onAddAfter: () => void;
  onPreview: () => void;
}> = ({ scene, index, count, readOnly, onChange, onMove, onRemove, onAddAfter, onPreview }) => {
  const shot = scene.camera?.shot ?? "wide";
  const castIds = scene.cast.map((m) => m.id);
  const setCamera = (s: StoryShot, focus?: StoryCharacterId) =>
    onChange((sc) => ({ ...sc, camera: s === "wide" ? undefined : { shot: s, focus: focus ?? sc.camera?.focus ?? castIds[0] } }));

  return (
    <section className="rounded-3xl bg-white p-4 sm:p-5 shadow-card space-y-4" aria-label={`Scene ${index + 1}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-medium text-textHeading">
          Scene {index + 1} <span className="text-sm text-textMuted font-sans">· {BACKGROUND_LABELS[scene.background]}</span>
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={smallBtn} onClick={onPreview}>▶ Preview</button>
          {!readOnly && (
            <>
              <button type="button" className={smallBtn} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move scene up">↑</button>
              <button type="button" className={smallBtn} disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move scene down">↓</button>
              <button type="button" className={`${smallBtn} text-red-600`} disabled={count <= 1} onClick={onRemove}>Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Place" value={scene.background} disabled={readOnly} onChange={(v) => onChange((sc) => ({ ...sc, background: v as StoryScene["background"] }))}>
          {STORY_BACKGROUNDS.map((b) => <option key={b} value={b}>{BACKGROUND_LABELS[b]}</option>)}
        </Select>
        <div className="flex gap-2 [&>*]:flex-1">
          <Select label="Camera" value={shot} disabled={readOnly || castIds.length === 0} onChange={(v) => setCamera(v as StoryShot)}>
            {(["wide", "medium", "close"] as const).map((s) => <option key={s} value={s}>{SHOT_LABELS[s]}</option>)}
          </Select>
          {shot !== "wide" && (
            <Select label="On" value={scene.camera?.focus ?? ""} disabled={readOnly} onChange={(v) => setCamera(shot, v as StoryCharacterId)}>
              {castIds.map((id) => <option key={id} value={id}>{characterLabel(id)}</option>)}
            </Select>
          )}
        </div>
        <Select label="Effect" value={scene.effect ?? "none"} disabled={readOnly} onChange={(v) => onChange((sc) => ({ ...sc, effect: v === "none" ? undefined : (v as StoryScene["effect"]) }))}>
          {STORY_EFFECTS.map((e) => <option key={e} value={e}>{EFFECT_LABELS[e]}</option>)}
        </Select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-textHeading mb-1">Who's in it</legend>
        {scene.cast.map((m) => (
          <div key={m.id} className="rounded-2xl bg-cream/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-textHeading">{characterLabel(m.id)}</span>
              {!readOnly && (
                <button type="button" className="text-xs font-medium text-red-600 underline" onClick={() => onChange((sc) => removeCast(sc, m.id))}>
                  Remove
                </button>
              )}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Select label="Where" value={m.slot} disabled={readOnly} onChange={(v) => onChange((sc) => updateCast(sc, m.id, { slot: v as typeof m.slot }))}>
                {STORY_SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
              </Select>
              <Select label="Face" value={m.expression ?? "calm"} disabled={readOnly} onChange={(v) => onChange((sc) => updateCast(sc, m.id, { expression: v as typeof m.expression }))}>
                {STORY_EXPRESSIONS.map((x) => <option key={x} value={x}>{FACE_LABELS[x]}</option>)}
              </Select>
              <Select label="Does" value={m.action ?? "idle"} disabled={readOnly} onChange={(v) => onChange((sc) => updateCast(sc, m.id, { action: v as typeof m.action }))}>
                {STORY_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
              </Select>
              {m.id !== "pip" && (
                <Select label="Sits?" value={m.pose ?? "stand"} disabled={readOnly} onChange={(v) => onChange((sc) => updateCast(sc, m.id, { pose: v as typeof m.pose }))}>
                  <option value="stand">Stands</option>
                  <option value="sit">Sits</option>
                </Select>
              )}
              {m.id !== "pip" && (
                <Select label="Holds" value={m.holding ?? ""} disabled={readOnly} onChange={(v) => onChange((sc) => updateCast(sc, m.id, { holding: (v || undefined) as typeof m.holding }))}>
                  <option value="">Nothing</option>
                  {STORY_PROPS.map((p) => <option key={p} value={p}>{PROP_LABELS[p]}</option>)}
                </Select>
              )}
            </div>
          </div>
        ))}
        {!readOnly && scene.cast.length < STORY_LIMITS.castPerScene && freeCharacters(scene).length > 0 && (
          <label className={`${labelClass} max-w-xs`}>
            Add someone
            <select className={field} value="" onChange={(e) => e.target.value && onChange((sc) => addCast(sc, e.target.value as StoryCharacterId))}>
              <option value="">Choose…</option>
              {freeCharacters(scene).map((c) => <option key={c} value={c}>{characterLabel(c)}</option>)}
            </select>
          </label>
        )}
        {(scene.background === "classroom" || scene.background === "playground" || scene.background.endsWith("_room")) && (
          <p className="text-xs text-textMuted">
            {scene.background === "classroom"
              ? "Chairs are at “Left of middle” and “Right of middle”."
              : scene.background === "playground"
                ? "The bench is on the left."
                : scene.background === "waiting_room"
                  ? "Chairs are on the left and left of middle."
                  : "The chair or bed is in the middle."}
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-textHeading mb-1">What they say</legend>
        {scene.lines.map((l, j) => (
          <div key={j} className="rounded-2xl border border-olive-100 p-3 space-y-2">
            <div className="flex items-end justify-between gap-2">
              <div className="w-44">
                <Select label="Who speaks" value={l.speaker} disabled={readOnly} onChange={(v) => onChange((sc) => updateLine(sc, j, { speaker: v as typeof l.speaker }))}>
                  <option value="narrator">Narrator</option>
                  {castIds.map((id) => <option key={id} value={id}>{characterLabel(id)}</option>)}
                </Select>
              </div>
              {!readOnly && scene.lines.length > 1 && (
                <button type="button" className="text-xs font-medium text-red-600 underline" onClick={() => onChange((sc) => removeLine(sc, j))}>
                  Remove line
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextArea label="English" lang="en" value={l.en} disabled={readOnly} onChange={(v) => onChange((sc) => updateLine(sc, j, { en: v }))} />
              <TextArea label="తెలుగు" lang="te" value={l.te} disabled={readOnly} onChange={(v) => onChange((sc) => updateLine(sc, j, { te: v }))} />
            </div>
          </div>
        ))}
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={smallBtn} disabled={scene.lines.length >= STORY_LIMITS.linesPerScene} onClick={() => onChange(addLine)}>
              + Add a line
            </button>
            <button type="button" className={smallBtn} disabled={count >= STORY_LIMITS.scenes} onClick={onAddAfter}>
              + Add a scene after this
            </button>
          </div>
        )}
      </fieldset>
    </section>
  );
};
