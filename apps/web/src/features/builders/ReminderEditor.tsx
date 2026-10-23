import React, { useCallback, useEffect, useState } from "react";
import {
  createReminder,
  deleteReminder,
  isValidTimeZone,
  updateReminder,
  type RoutineTarget,
} from "@safespace/api-client";
import type { Reminder, ReminderKind, RoutineWithSteps } from "@safespace/shared-types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ConfirmButton, DayPicker, SelectField, TextField } from "./BuilderFields";
import { LEAD_OPTIONS, daysLabel, deviceTimeZone, leadLabel, validateReminder, type ReminderDraft } from "./builders";

const KIND_LABELS: Record<ReminderKind, string> = {
  water: "Drink water",
  medication: "Medicine",
  wellness: "Wellbeing",
  routine: "Start a routine",
  custom: "Something else",
};
const KIND_ORDER: ReminderKind[] = ["water", "medication", "wellness", "routine", "custom"];

const draftFrom = (r?: Reminder): ReminderDraft =>
  r
    ? { kind: r.kind, title: r.title, routineId: r.routineId, timeOfDay: r.timeOfDay, daysOfWeek: r.daysOfWeek, timezone: r.timezone, leadMinutes: r.leadMinutes }
    : { kind: "water", title: "", routineId: null, timeOfDay: "08:00", daysOfWeek: [], timezone: deviceTimeZone(), leadMinutes: 0 };

interface Props {
  target: RoutineTarget;
  loadReminders: () => Promise<Reminder[]>;
  loadRoutines: () => Promise<RoutineWithSteps[]>;   // for "Start a routine" reminders
  emptyText?: string;
  livesElsewhereHint: string;                         // e.g. "if the child lives somewhere else"
}

// Reminders with type, routine link, time, days, a heads-up before the time
// (P2) and time zone; turn on/off, edit, delete (role-flow 4c, shared in 7b).
export const ReminderEditor: React.FC<Props> = ({ target, loadReminders, loadRoutines, emptyText = "No reminders yet.", livesElsewhereHint }) => {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [routines, setRoutines] = useState<RoutineWithSteps[]>([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [rem, rts] = await Promise.all([loadReminders(), loadRoutines()]);
      setReminders(rem);
      setRoutines(rts);
    } catch {
      setError("Couldn't load reminders right now.");
    }
  }, [loadReminders, loadRoutines]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await reload();
      return true;
    } catch {
      setError("That didn't save. Please try again.");
      return false;
    }
  };

  const save = async (draft: ReminderDraft, existing?: Reminder) => {
    const body = {
      title: draft.title.trim(),
      timeOfDay: draft.timeOfDay,
      daysOfWeek: draft.daysOfWeek,
      timezone: draft.timezone,
      leadMinutes: draft.leadMinutes,
    };
    const ok = existing
      ? await run(() => updateReminder(existing.id, body))
      : await run(() => createReminder(target, { ...body, kind: draft.kind, routineId: draft.kind === "routine" ? draft.routineId : null }));
    if (ok) setEditing(null);
  };

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {editing === "new" ? (
        <ReminderForm draft={draftFrom()} routines={routines} hint={livesElsewhereHint} onCancel={() => setEditing(null)} onSave={(d) => save(d)} />
      ) : (
        <Button variant="olive" onClick={() => setEditing("new")}>New reminder</Button>
      )}

      {reminders === null && !error && <p className="text-textBody">Loading reminders...</p>}
      {reminders?.length === 0 && editing !== "new" && (
        <Card><p className="text-textBody">{emptyText}</p></Card>
      )}

      <ul className="space-y-3">
        {reminders?.map((r) => (
          <li key={r.id}>
            {editing === r.id ? (
              <ReminderForm draft={draftFrom(r)} routines={routines} hint={livesElsewhereHint} existing onCancel={() => setEditing(null)} onSave={(d) => save(d, r)} />
            ) : (
              <Card className={`p-5 flex flex-wrap items-center justify-between gap-3 border ${r.isEnabled ? "border-olive-100" : "border-dashed border-olive-200 opacity-80"}`}>
                <div>
                  <p className="font-display text-base font-medium text-textHeading">
                    <span className="text-deepGreen">{r.timeOfDay}</span> · {r.title}
                  </p>
                  <p className="text-xs text-textMuted">
                    {KIND_LABELS[r.kind]} · {daysLabel(r.daysOfWeek)}
                    {leadLabel(r.leadMinutes) && ` · ${leadLabel(r.leadMinutes)}`}
                    {r.timezone !== deviceTimeZone() && ` · ${r.timezone}`}
                    {!r.isEnabled && " · Off"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <button type="button" onClick={() => setEditing(r.id)} className="font-medium text-deepGreen underline">Edit</button>
                  <button type="button" onClick={() => run(() => updateReminder(r.id, { isEnabled: !r.isEnabled }))} className="font-medium text-deepGreen underline">
                    {r.isEnabled ? "Turn off" : "Turn on"}
                  </button>
                  <ConfirmButton label="Delete" confirmLabel={`Delete "${r.title}"`} onConfirm={() => run(() => deleteReminder(r.id))} />
                </div>
              </Card>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const ReminderForm: React.FC<{
  draft: ReminderDraft;
  routines: RoutineWithSteps[];
  hint: string;
  existing?: boolean;
  onSave: (d: ReminderDraft) => Promise<void>;
  onCancel: () => void;
}> = ({ draft: initial, routines, hint, existing, onSave, onCancel }) => {
  const [d, setD] = useState<ReminderDraft>(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = validateReminder(d) ?? (isValidTimeZone(d.timezone) ? null : "That time zone isn't recognised, e.g. Asia/Kolkata.");
    setProblem(p);
    if (p) return;
    setSaving(true);
    await onSave(d);
    setSaving(false);
  }

  return (
    <Card className="p-6 border border-olive-100">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-display text-lg font-medium text-textHeading">{existing ? "Edit reminder" : "New reminder"}</h2>
        {!existing && (
          <SelectField
            label="Type"
            value={d.kind}
            onChange={(v) => setD({ ...d, kind: v as ReminderKind, routineId: v === "routine" ? d.routineId : null })}
          >
            {KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </SelectField>
        )}
        {!existing && d.kind === "routine" && (
          <SelectField
            label="Which routine"
            value={d.routineId ?? ""}
            onChange={(v) => setD({ ...d, routineId: v || null, title: d.title || (routines.find((r) => r.id === v)?.title ?? "") })}
          >
            <option value="">Choose a routine</option>
            {routines.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </SelectField>
        )}
        <TextField label="What it says" value={d.title} onChange={(title) => setD({ ...d, title })} maxLength={80} placeholder="e.g. Drink a glass of water" />
        {d.kind === "medication" && (
          <p className="-mt-2 text-[11px] text-textMuted">Keep it general, like "Take your medicine". Don't add names or doses.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Time" type="time" value={d.timeOfDay} onChange={(timeOfDay) => setD({ ...d, timeOfDay })} />
          <SelectField label="Heads-up before" value={String(d.leadMinutes)} onChange={(v) => setD({ ...d, leadMinutes: Number(v) })}>
            {LEAD_OPTIONS.map((m) => <option key={m} value={m}>{m === 0 ? "No heads-up" : leadLabel(m)?.replace(" heads-up", "")}</option>)}
            {!LEAD_OPTIONS.includes(d.leadMinutes as (typeof LEAD_OPTIONS)[number]) && <option value={d.leadMinutes}>{d.leadMinutes} min</option>}
          </SelectField>
        </div>
        <DayPicker value={d.daysOfWeek} onChange={(daysOfWeek) => setD({ ...d, daysOfWeek })} />
        <TextField label="Time zone" value={d.timezone} onChange={(timezone) => setD({ ...d, timezone: timezone.trim() })} placeholder="e.g. Asia/Kolkata" />
        <p className="-mt-2 text-[11px] text-textMuted">Defaults to this device's time zone. Change it {hint}.</p>
        {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="olive" size="sm" disabled={saving}>{saving ? "Saving..." : "Save reminder"}</Button>
        </div>
      </form>
    </Card>
  );
};
