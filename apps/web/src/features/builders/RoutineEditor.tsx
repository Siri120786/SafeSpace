import React, { useCallback, useEffect, useState } from "react";
import {
  addRoutineStep,
  createRoutine,
  deleteRoutine,
  deleteRoutineStep,
  reorderRoutineSteps,
  updateRoutine,
  updateRoutineStep,
  type RoutineTarget,
} from "@safespace/api-client";
import type { RoutineStep, RoutineWithSteps } from "@safespace/shared-types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ConfirmButton, DayPicker, StepFields, TextField } from "./BuilderFields";
import { daysLabel, iconEmoji, moveStep, validateRoutine, validateStep, type RoutineDraft, type StepDraft } from "./builders";

const emptyStep = (): StepDraft => ({ label: "", scheduledTime: "", icon: null });
const FAILED = "That didn't save. Please try again.";

interface Props {
  // Whose routines: a caregiver's child, or the signed-in Individual's own.
  target: RoutineTarget;
  // Every routine to edit, paused ones included.
  load: () => Promise<RoutineWithSteps[]>;
  emptyText: string;
  pausedNote: string;   // shown on a paused routine, e.g. "hidden from the child"
}

// Create, rename, choose days, pause and delete routines; add, edit, reorder
// and remove steps with icon and time (role-flow 4c, shared in 7b).
export const RoutineEditor: React.FC<Props> = ({ target, load, emptyText, pausedNote }) => {
  const [routines, setRoutines] = useState<RoutineWithSteps[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRoutines(await load());
    } catch {
      setError("Couldn't load routines right now.");
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Runs an api call, then reloads; shows a friendly error if it fails.
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await reload();
      return true;
    } catch {
      setError(FAILED);
      return false;
    }
  }, [reload]);

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {creating ? (
        <NewRoutineForm
          onCancel={() => setCreating(false)}
          onSave={async (draft) => {
            const saved = await run(() => createRoutine(target, {
              title: draft.title.trim(),
              daysOfWeek: draft.daysOfWeek,
              steps: draft.steps.map((s) => ({ label: s.label.trim(), scheduledTime: s.scheduledTime || null, icon: s.icon })),
            }));
            if (saved) setCreating(false);
          }}
        />
      ) : (
        <Button variant="olive" onClick={() => setCreating(true)}>
          New routine
        </Button>
      )}

      {routines === null && !error && <p className="text-textBody">Loading routines...</p>}
      {routines?.length === 0 && !creating && (
        <Card><p className="text-textBody">{emptyText}</p></Card>
      )}

      {routines?.map((r) => (
        <RoutineCard key={r.id} routine={r} run={run} pausedNote={pausedNote} />
      ))}
    </div>
  );
};

const NewRoutineForm: React.FC<{ onSave: (d: RoutineDraft) => Promise<void>; onCancel: () => void }> = ({ onSave, onCancel }) => {
  const [draft, setDraft] = useState<RoutineDraft>({ title: "", daysOfWeek: [], steps: [emptyStep()] });
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setStep = (i: number, s: StepDraft) => setDraft({ ...draft, steps: draft.steps.map((x, j) => (j === i ? s : x)) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = validateRoutine(draft);
    setProblem(p);
    if (p) return;
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  return (
    <Card className="p-6 border border-olive-100">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-display text-lg font-medium text-textHeading">New routine</h2>
        <TextField label="Name" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} maxLength={80} placeholder="e.g. Morning" />
        <DayPicker value={draft.daysOfWeek} onChange={(daysOfWeek) => setDraft({ ...draft, daysOfWeek })} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-textHeading mb-1">Steps, in order</legend>
          {draft.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1"><StepFields value={s} onChange={(v) => setStep(i, v)} index={i} /></div>
              <button
                type="button"
                aria-label={`Remove step ${i + 1}`}
                onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
                className="mt-2 text-xs text-red-600 underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setDraft({ ...draft, steps: [...draft.steps, emptyStep()] })} className="text-sm font-medium text-deepGreen underline">
            + Add a step
          </button>
        </fieldset>
        {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="olive" size="sm" disabled={saving}>{saving ? "Saving..." : "Save routine"}</Button>
        </div>
      </form>
    </Card>
  );
};

type Run = (fn: () => Promise<unknown>) => Promise<boolean>;

const RoutineCard: React.FC<{ routine: RoutineWithSteps; run: Run; pausedNote: string }> = ({ routine: r, run, pausedNote }) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(r.title);
  const [days, setDays] = useState(r.daysOfWeek);
  const [adding, setAdding] = useState<StepDraft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const ids = r.steps.map((s) => s.id);

  async function saveDetails() {
    if (!title.trim()) return setProblem("Give the routine a name.");
    setProblem(null);
    if (await run(() => updateRoutine(r.id, { title: title.trim(), daysOfWeek: days }))) setEditing(false);
  }

  async function saveNewStep() {
    if (!adding) return;
    const p = validateStep(adding);
    setProblem(p);
    if (p) return;
    if (await run(() => addRoutineStep(r.id, { label: adding.label.trim(), scheduledTime: adding.scheduledTime || null, icon: adding.icon }))) {
      setAdding(null);
    }
  }

  return (
    <Card className={`p-6 space-y-4 border ${r.isActive ? "border-olive-100" : "border-dashed border-olive-200 opacity-80"}`}>
      {editing ? (
        <div className="space-y-3">
          <TextField label="Name" value={title} onChange={setTitle} maxLength={80} />
          <DayPicker value={days} onChange={setDays} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setTitle(r.title); setDays(r.daysOfWeek); }}>Cancel</Button>
            <Button variant="olive" size="sm" onClick={saveDetails}>Save</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium text-textHeading">{r.title}</h2>
            <p className="text-xs text-textMuted">{daysLabel(r.daysOfWeek)}{!r.isActive && ` · ${pausedNote}`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button type="button" onClick={() => setEditing(true)} className="font-medium text-deepGreen underline">Edit name and days</button>
            <button type="button" onClick={() => run(() => updateRoutine(r.id, { isActive: !r.isActive }))} className="font-medium text-deepGreen underline">
              {r.isActive ? "Pause" : "Turn back on"}
            </button>
            <ConfirmButton label="Delete routine" confirmLabel={`Delete "${r.title}"`} onConfirm={() => run(() => deleteRoutine(r.id))} />
          </div>
        </div>
      )}

      <ol className="space-y-2">
        {r.steps.map((s, i) => (
          <StepRow
            key={s.id}
            step={s}
            index={i}
            count={r.steps.length}
            run={run}
            onMove={(dir) => {
              const order = moveStep(ids, i, dir);
              if (order) run(() => reorderRoutineSteps(r.id, order));
            }}
          />
        ))}
      </ol>

      {adding ? (
        <div className="space-y-2 rounded-2xl bg-olive-50/60 p-3">
          <StepFields value={adding} onChange={setAdding} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAdding(null); setProblem(null); }}>Cancel</Button>
            <Button variant="olive" size="sm" onClick={saveNewStep}>Add step</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(emptyStep())} className="text-sm font-medium text-deepGreen underline">
          + Add a step
        </button>
      )}
      {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}
    </Card>
  );
};

const StepRow: React.FC<{
  step: RoutineStep;
  index: number;
  count: number;
  run: Run;
  onMove: (dir: -1 | 1) => void;
}> = ({ step: s, index, count, run, onMove }) => {
  const [draft, setDraft] = useState<StepDraft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    const p = validateStep(draft);
    setProblem(p);
    if (p) return;
    if (await run(() => updateRoutineStep(s.id, { label: draft.label.trim(), scheduledTime: draft.scheduledTime || null, icon: draft.icon }))) {
      setDraft(null);
    }
  }

  if (draft) {
    return (
      <li className="space-y-2 rounded-2xl bg-olive-50/60 p-3">
        <StepFields value={draft} onChange={setDraft} index={index} />
        {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setDraft(null); setProblem(null); }}>Cancel</Button>
          <Button variant="olive" size="sm" onClick={save}>Save step</Button>
        </div>
      </li>
    );
  }

  const emoji = iconEmoji(s.icon);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-olive-100 bg-white px-3 py-2">
      <span aria-hidden="true" className="w-7 text-center text-xl">{emoji ?? "•"}</span>
      <span className="flex-1 min-w-[8rem] text-sm text-textHeading">
        {s.scheduledTime && <span className="mr-2 font-medium text-deepGreen">{s.scheduledTime}</span>}
        {s.label}
      </span>
      <span className="flex items-center gap-2 text-xs">
        <button type="button" aria-label={`Move "${s.label}" up`} disabled={index === 0} onClick={() => onMove(-1)} className="rounded-lg border border-olive-200 px-2 py-1 disabled:opacity-40">↑</button>
        <button type="button" aria-label={`Move "${s.label}" down`} disabled={index === count - 1} onClick={() => onMove(1)} className="rounded-lg border border-olive-200 px-2 py-1 disabled:opacity-40">↓</button>
        <button
          type="button"
          onClick={() => setDraft({ label: s.label, scheduledTime: s.scheduledTime ?? "", icon: s.icon })}
          className="font-medium text-deepGreen underline"
        >
          Edit
        </button>
        <ConfirmButton label="Remove" confirmLabel="Remove step" onConfirm={() => run(() => deleteRoutineStep(s.id))} />
      </span>
    </li>
  );
};
