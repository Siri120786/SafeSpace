import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getChildToolSetup, setChildStarGoal, setChildToolSettings, type StarGoal, type ToolSettings } from "@safespace/api-client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { CaregiverPageShell, SelectField, TextField, caregiverChildPath, useCaregiverChild } from "../features/caregiver";
import { COUNTDOWN_MINUTES, GOAL_ICONS, RENAMEABLE_WORDS, validGoal, wordLabelsToSave } from "../features/conditions";
import { ROUTES } from "../routes";

// /caregiver/children/:childId/tools (role-flow 8f): set up a child's ADHD
// and autism tools. Any caregiver of the child, whatever their sharing
// choice: this is setup, not activity. The child sees each change the next
// time they open the tool.
export const CaregiverChildToolsPage: React.FC = () => {
  const { childId = "" } = useParams();
  const { child, error } = useCaregiverChild(childId);
  const [setup, setSetup] = useState<{ goal: StarGoal | null; settings: ToolSettings } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getChildToolSetup(childId).then((s) => live && setSetup(s)).catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [childId]);

  if (error === "not_found") {
    return (
      <CaregiverPageShell title="Child not found" backTo={ROUTES.CAREGIVER_HOME}>
        <Card><p className="text-textBody">This child isn't one of yours, or no longer is.</p></Card>
      </CaregiverPageShell>
    );
  }
  if (!child || !setup) {
    return (
      <CaregiverPageShell title="Tools" backTo={caregiverChildPath(childId)} backLabel="Back">
        {error || loadFailed ? <p role="alert" className="text-sm text-red-700">Couldn't load this right now.</p> : <p className="text-textBody">Loading...</p>}
      </CaregiverPageShell>
    );
  }

  return (
    <CaregiverPageShell
      title={`${child.name}'s tools`}
      subtitle="The star goal, the countdown and the talk-board words. Any of their caregivers can change these."
      backTo={caregiverChildPath(childId)}
      backLabel={`Back to ${child.name}`}
    >
      <GoalCard childId={childId} name={child.name} goal={setup.goal} />
      <CountdownCard childId={childId} name={child.name} preset={setup.settings.transitionPreset} />
      <WordsCard childId={childId} name={child.name} labels={setup.settings.aacLabels} />
    </CaregiverPageShell>
  );
};

function useSave() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: "Saved." });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setMessage({ ok: false, text: code === "invalid_input" ? "Check what you entered." : "That didn't save. Please try again." });
    } finally {
      setSaving(false);
    }
  };
  const status = message && (
    <span role="status" className={`text-sm ${message.ok ? "text-deepGreen" : "text-red-700"}`}>{message.text}</span>
  );
  return { saving, run, status, setMessage };
}

const GoalCard: React.FC<{ childId: string; name: string; goal: StarGoal | null }> = ({ childId, name, goal }) => {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [target, setTarget] = useState(goal?.targetStars ?? 10);
  const [icon, setIcon] = useState(goal?.icon ?? GOAL_ICONS[0]);
  const { saving, run, status, setMessage } = useSave();
  const save = () => {
    const problem = validGoal(title, target);
    if (problem) return setMessage({ ok: false, text: problem });
    run(() => setChildStarGoal(childId, { title: title.trim(), targetStars: target, icon }));
  };
  return (
    <Card className="p-6 space-y-3 border border-olive-100">
      <h2 className="font-display text-lg font-medium text-textHeading">Star goal</h2>
      <p className="text-sm text-textBody">
        {name} earns stars in Focus Zone for finishing task steps and ticking habits. What are they working toward?
        {!goal && " (No goal yet: they see the default, a movie or game night at 10 stars.)"}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <TextField label="The reward" value={title} onChange={setTitle} maxLength={60} placeholder="e.g. Park trip" />
        <TextField label="Stars needed" type="number" value={String(target)} onChange={(v) => setTarget(Number(v))} />
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-textHeading mb-1.5">Picture</legend>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_ICONS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={icon === e}
              aria-label={`Use ${e}`}
              onClick={() => setIcon(e)}
              className={`h-10 w-10 rounded-xl border text-xl ${icon === e ? "border-deepGreen bg-olive-50" : "border-olive-100 bg-white"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="olive" onClick={save} disabled={saving}>Save goal</Button>
        {status}
      </div>
    </Card>
  );
};

const CountdownCard: React.FC<{ childId: string; name: string; preset: ToolSettings["transitionPreset"] }> = ({ childId, name, preset }) => {
  const [activity, setActivity] = useState(preset?.activity ?? "");
  const [minutes, setMinutes] = useState(String(preset ? Math.max(1, Math.round(preset.totalSeconds / 60)) : 5));
  const { saving, run, status, setMessage } = useSave();
  const save = () => {
    if (!activity.trim()) return setMessage({ ok: false, text: "Say what's coming next." });
    run(() => setChildToolSettings(childId, { transitionPreset: { activity: activity.trim().slice(0, 60), totalSeconds: Number(minutes) * 60 } }));
  };
  return (
    <Card className="p-6 space-y-3 border border-olive-100">
      <h2 className="font-display text-lg font-medium text-textHeading">Countdown</h2>
      <p className="text-sm text-textBody">The countdown {name} sees first, before a change in their day.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <TextField label="What's coming next" value={activity} onChange={setActivity} maxLength={60} placeholder="e.g. Bath time" />
        <SelectField label="How long" value={minutes} onChange={setMinutes}>
          {COUNTDOWN_MINUTES.map((m) => <option key={m} value={m}>{m} minute{m === 1 ? "" : "s"}</option>)}
        </SelectField>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="olive" onClick={save} disabled={saving}>Save countdown</Button>
        {status}
      </div>
    </Card>
  );
};

const WordsCard: React.FC<{ childId: string; name: string; labels: Record<string, string> }> = ({ childId, name, labels }) => {
  const [edits, setEdits] = useState<Record<string, string>>(() => ({ ...labels }));
  const { saving, run, status } = useSave();
  return (
    <Card className="p-6 space-y-3 border border-olive-100">
      <h2 className="font-display text-lg font-medium text-textHeading">Talk-board words</h2>
      <p className="text-sm text-textBody">
        Rename the words in {name}'s "Build a sentence", e.g. "Play" to "Lego". Leave a box empty to keep the word as it is.
        "I need help" always stays the same.
      </p>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {RENAMEABLE_WORDS.map((w) => (
          <label key={w.id} className="mt-0 flex items-center gap-2 text-sm text-charcoal">
            <span aria-hidden="true" className="w-6 text-center text-lg">{w.emoji}</span>
            <span className="w-24 shrink-0">{w.label}</span>
            <input
              className="w-full rounded-xl border border-olive-200 bg-white px-2.5 py-1.5 text-sm"
              value={edits[w.id] ?? ""}
              maxLength={30}
              placeholder={w.label}
              aria-label={`New word for ${w.label}`}
              onChange={(e) => setEdits({ ...edits, [w.id]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="olive" disabled={saving} onClick={() => run(() => setChildToolSettings(childId, { aacLabels: wordLabelsToSave(edits) }))}>
          Save words
        </Button>
        {status}
      </div>
    </Card>
  );
};

export default CaregiverChildToolsPage;
