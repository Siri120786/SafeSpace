import React, { useState } from "react";
import { OceanCalmSpace } from "../../conditions/anxiety/ocean/OceanCalmPages";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { CalmToolShell } from "../../calm-tools/components/CalmToolShell";
import {
  ANXIETY_TIPS,
  CARE_BRIDGING_TEXT,
  ENCOURAGEMENTS,
  GOAL_IDEAS,
  GRATITUDE_PROMPT,
  HOBBY_IDEAS,
  MODULES,
  PCOS_CHECKLIST,
  RELAXATION_STEPS,
  REVIEW_NOTICE,
  SLEEP_STRESS_IDEAS,
  SUPPORT_TEXT,
  canOpenCycleCare,
  type ModuleInfo,
} from "../lib/content";
import { useCondition } from "./useCondition";
import { visitQuestionsFor } from "../lib/condition";
import { MedicineReminders } from "./MedicineReminders";
import type { AppSession } from "@safespace/shared-types";
import { BodyKindness, DailyCheckIn, DoctorVisitPrep, MedicationNotes } from "./CycleCareExtras";

export interface ModuleScreenProps {
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
  // Where these screens are mounted. Defaults are the adult routes; the
  // child's space passes its own (role-flow 5b).
  paths?: { base: string };
  // Modules to list on the home screen (default: all).
  onlyKeys?: readonly ModuleInfo["key"][];
  // The caregiver story workflow link (default: shown).
  showStoryWorkflow?: boolean;
}

const modulePath = (p: ModuleScreenProps, m: ModuleInfo) => (p.paths ? `${p.paths.base}${m.path.slice("/modules".length)}` : m.path);
// The breathing and grounding exercises live in Calm Space (the ocean).
const calmPath = (p: Pick<ModuleScreenProps, "paths">, tool: "breathing" | "grounding") => `${p.paths?.base ?? "/modules"}/calm-space/${tool}`;

const linkClass = "block rounded-3xl focus:outline-none focus:ring-2 focus:ring-olive-500 focus:ring-offset-2";
const fieldClass =
  "w-full rounded-2xl border border-olive-200 bg-white px-4 py-3 text-base text-textBody focus:outline-none focus:ring-2 focus:ring-olive-500";

export const Notes: React.FC<{ extra?: string }> = ({ extra }) => (
  <div className="space-y-2">
    <p role="note" className="rounded-2xl bg-white/80 border border-olive-200 px-4 py-3 text-sm text-textBody">
      {REVIEW_NOTICE} Your entries stay on this page only and are not saved yet.
      {extra ? ` ${extra}` : ""}
    </p>
    <p className="text-sm text-textBody">{SUPPORT_TEXT}</p>
  </div>
);

export const ModulesHome: React.FC<ModuleScreenProps> = (p) => (
  <CalmToolShell title="Wellness modules" {...p}>
    <div className="space-y-4">
      {MODULES.filter((m) => !p.onlyKeys || p.onlyKeys.includes(m.key)).map((m) => (
        <Link key={m.key} to={modulePath(p, m)} className={linkClass}>
          <Card hoverable className="space-y-1">
            <h2 className="font-display text-xl text-textHeading">{m.name}</h2>
            <p className="text-sm text-textBody">{m.blurb}</p>
          </Card>
        </Link>
      ))}
      {p.showStoryWorkflow !== false && (
        <Link to="/caregiver/stories" className={linkClass}>
          <Card hoverable className="space-y-1">
            <h2 className="font-display text-xl text-textHeading">Stories</h2>
            <p className="text-sm text-textBody">For caregivers: make animated social stories and publish them to your children.</p>
          </Card>
        </Link>
      )}
    </div>
  </CalmToolShell>
);

// Calm Space (anxiety): the ocean, with Aurelia's jellyfish (conditions/anxiety/ocean).
export const CalmSpace: React.FC<ModuleScreenProps> = (p) => (
  <OceanCalmSpace lowSensory={p.lowSensory} onExit={p.onExit} notice={p.notice} base={p.paths?.base ?? "/modules"} />
);

export const BrightDays: React.FC<ModuleScreenProps> = (p) => {
  const [goals, setGoals] = useState<{ text: string; done: boolean }[]>([]);
  const [goalText, setGoalText] = useState("");
  const [gratitude, setGratitude] = useState<string[]>([]);
  const [gratitudeText, setGratitudeText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addGoal = (text: string) => {
    const t = text.trim();
    if (!t) return setError("Please type a goal first.");
    setError(null);
    setGoals((g) => [...g, { text: t, done: false }]);
    setGoalText("");
  };
  const toggle = (i: number) => {
    const becameDone = !goals[i].done;
    setGoals((g) => g.map((x, j) => (j === i ? { ...x, done: !x.done } : x)));
    setMessage(becameDone ? ENCOURAGEMENTS[i % ENCOURAGEMENTS.length] : null);
  };
  const addGratitude = () => {
    const t = gratitudeText.trim();
    if (!t) return setError("Please write something first.");
    setError(null);
    setGratitude((g) => [...g, t]);
    setGratitudeText("");
  };

  return (
    <CalmToolShell title="Bright Days" {...p}>
      <div className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">My small goals</h2>
          <p className="text-sm text-textBody">Pick your own. Skip any you like. Ideas:</p>
          <div className="flex flex-wrap gap-2">
            {GOAL_IDEAS.map((g) => (
              <Button key={g} size="sm" variant="outline" onClick={() => addGoal(g)}>
                {g}
              </Button>
            ))}
          </div>
          <label htmlFor="goal-input" className="block text-sm text-textBody">
            Or write your own
          </label>
          <input id="goal-input" className={fieldClass} value={goalText} onChange={(e) => setGoalText(e.target.value)} />
          <Button size="sm" variant="primary" onClick={() => addGoal(goalText)}>
            Add goal
          </Button>
          <ul className="space-y-2">
            {goals.map((g, i) => (
              <li key={`${g.text}-${i}`} className="flex items-center gap-3">
                <input id={`goal-${i}`} type="checkbox" checked={g.done} onChange={() => toggle(i)} className="h-5 w-5" />
                <label htmlFor={`goal-${i}`} className={`text-base ${g.done ? "line-through text-textMuted" : "text-textBody"}`}>
                  {g.text}
                </label>
              </li>
            ))}
          </ul>
          {message && (
            <p role="status" className="text-base text-deepGreen">
              {message}
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">Gratitude notes</h2>
          <label htmlFor="gratitude-input" className="block text-sm text-textBody">
            {GRATITUDE_PROMPT}
          </label>
          <input id="gratitude-input" className={fieldClass} value={gratitudeText} onChange={(e) => setGratitudeText(e.target.value)} />
          <Button size="sm" variant="primary" onClick={addGratitude}>
            Add note
          </Button>
          <ul className="list-disc pl-5 text-base text-textBody space-y-1">
            {gratitude.map((g, i) => (
              <li key={`${g}-${i}`}>{g}</li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-2">
          <h2 className="font-display text-xl text-textHeading">Hobby ideas (optional)</h2>
          <ul className="list-disc pl-5 text-base text-textBody space-y-1">
            {HOBBY_IDEAS.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </Card>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Notes />
      </div>
    </CalmToolShell>
  );
};

/** Safe Harbor always runs in low-sensory mode, whatever the other settings say. */
export const SafeHarbor: React.FC<ModuleScreenProps> = ({ onExit, notice, paths }) => {
  const [step, setStep] = useState(0);
  const last = step === RELAXATION_STEPS.length - 1;
  return (
    <CalmToolShell title="Safe Harbor" onExit={onExit} lowSensory={true} notice={notice}>
      <div className="space-y-4">
        <p className="text-sm text-textBody">This is a quiet space. Nothing moves and there is no sound. You can leave at any time.</p>
        <Card className="space-y-4">
          <p className="text-sm text-textMuted">
            Relaxation, step {step + 1} of {RELAXATION_STEPS.length}
          </p>
          <p role="status" aria-live="polite" className="text-lg leading-relaxed text-textBody">
            {RELAXATION_STEPS[step]}
          </p>
          <div className="flex justify-between gap-3">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </Button>
            <Button variant="primary" disabled={last} onClick={() => setStep(step + 1)}>
              Next
            </Button>
          </div>
        </Card>
        <Card className="space-y-2">
          <Link to={calmPath({ paths }, "grounding")} className="underline text-deepGreen">
            Try the grounding activity
          </Link>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-display text-xl text-textHeading">Support from people</h2>
          <p className="text-base text-textBody">{CARE_BRIDGING_TEXT}</p>
        </Card>
        <Notes extra="This is not treatment." />
      </div>
    </CalmToolShell>
  );
};

export const CycleCare: React.FC<ModuleScreenProps & { role: string | null; session?: AppSession }> = ({ role, session, ...p }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [condition] = useCondition();

  if (!canOpenCycleCare(role)) {
    return (
      <CalmToolShell title="Cycle Care" {...p}>
        <Card>
          <p role="status" className="text-base text-textBody">
            Cycle Care is for adult accounts only for now.
          </p>
        </Card>
      </CalmToolShell>
    );
  }

  return (
    <CalmToolShell title="Cycle Care" {...p}>
      <div className="space-y-4">
        <Link to={`${p.paths?.base ?? "/modules"}/pcos-pcod`} className="underline text-deepGreen text-sm">
          Back to PCOS / PCOD
        </Link>
        <DailyCheckIn />
        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">Today's self-care</h2>
          <ul className="space-y-2">
            {PCOS_CHECKLIST.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <input
                  id={`cc-${item.id}`}
                  type="checkbox"
                  className="h-5 w-5"
                  checked={!!checked[item.id]}
                  onChange={() => setChecked((c) => ({ ...c, [item.id]: !c[item.id] }))}
                />
                <label htmlFor={`cc-${item.id}`} className="text-base text-textBody">
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
          <p className="text-sm text-textMuted">This checklist does not send reminders. It resets when you leave the page.</p>
        </Card>
        <MedicationNotes />
        <MedicineReminders session={session} />
        <DoctorVisitPrep prompts={visitQuestionsFor(condition)} />
        <Card className="space-y-2">
          <h2 className="font-display text-xl text-textHeading">Sleep and stress</h2>
          <ul className="list-disc pl-5 text-base text-textBody space-y-1">
            {SLEEP_STRESS_IDEAS.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Link to={calmPath(p, "breathing")} className="underline text-deepGreen">
            Open the breathing exercise
          </Link>
        </Card>
        <BodyKindness />
        <Notes extra="There is no cycle tracking in this version. Always follow your own doctor's advice." />
      </div>
    </CalmToolShell>
  );
};
