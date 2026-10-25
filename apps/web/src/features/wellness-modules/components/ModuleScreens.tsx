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
import { BodyKindness, MedicationNotes } from "./CycleCareExtras";
import { DoctorTopic, TrackerTopic } from "./PcosTopics";
import { HarborPage } from "../../conditions/ptsd/harbor/HarborPage";
import { BrightDaysRoom } from "../../conditions/depression/door/BrightDaysRoom";
import { AdultsOnly, PcosShell } from "./PcosScreens";

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

/** Bright Days (depression) in its night garden: small steps let the light in. */
export const BrightDays: React.FC<ModuleScreenProps> = ({ lowSensory, onExit, notice }) => (
  <BrightDaysRoom lowSensory={lowSensory} onExit={onExit} notice={notice} />
);

/** Safe Harbor (PTSD) in its rainy-window room: still unless the person asks for rain. */
export const SafeHarbor: React.FC<ModuleScreenProps> = ({ lowSensory, onExit, notice, paths }) => (
  <HarborPage
    lowSensory={lowSensory}
    onExit={onExit}
    notice={notice}
    groundingPath={calmPath({ paths }, "grounding")}
    forChild={!!paths?.base.startsWith("/child")}
  />
);

export const CycleCare: React.FC<ModuleScreenProps & { role: string | null; session?: AppSession }> = ({ role, session, ...p }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [condition] = useCondition();

  if (!canOpenCycleCare(role)) return <AdultsOnly title="Cycle Care" page="cycle-care" {...p} />;

  return (
    <PcosShell title="Cycle Care" page="cycle-care" lead="Check in with yourself, keep your medicine notes and get ready for your next doctor visit." {...p}>
      <div className="space-y-4">
        <TrackerTopic />
        <DoctorTopic prompts={visitQuestionsFor(condition)} />
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
        <BodyKindness />
        <Notes extra="Always follow your own doctor's advice." />
      </div>
    </PcosShell>
  );
};
