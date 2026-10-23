import React, { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { listMyRoutineSetup, listReminders } from "@safespace/api-client";
import { useAuth } from "../features/auth";
import { MyJournal, MyReminders, MyRoutines, MyToolsShell } from "../features/my-tools";
import { ReminderEditor, RoutineEditor } from "../features/builders";
import { ChatWindow } from "../features/ai-companion";
import { ROUTES } from "../routes";

// An Individual's own tool pages (docs/role-flow/CONTRACT.md section 3, D2).
// RoleRoute only lets Individuals in, so the session is theirs. Routines and
// reminders show today's view by default; "?edit=1" switches to setting them up.

function useEditMode() {
  const [params, setParams] = useSearchParams();
  const editing = params.get("edit") === "1";
  const setEditing = (on: boolean) => setParams(on ? { edit: "1" } : {}, { replace: true });
  return [editing, setEditing] as const;
}

const EditToggle: React.FC<{ editing: boolean; onChange: (on: boolean) => void; label: string }> = ({ editing, onChange, label }) => (
  <button
    type="button"
    aria-pressed={editing}
    onClick={() => onChange(!editing)}
    className="rounded-full border border-olive-200 bg-white px-4 py-2 text-sm font-semibold text-deepGreen hover:bg-olive-50 focus:outline-none focus:ring-2 focus:ring-olive-500"
  >
    {editing ? "Done" : label}
  </button>
);

export const IndividualRoutinesPage: React.FC = () => {
  const { session } = useAuth();
  const [editing, setEditing] = useEditMode();
  const load = useCallback(() => listMyRoutineSetup(session), [session]);
  if (!session) return null;
  return (
    <MyToolsShell
      title={editing ? "Set up my routines" : "My routines"}
      subtitle={editing ? "Steps with a time, icon and name, on the days you choose." : "Tick off steps as you go, for today or the last few days."}
      backTo={ROUTES.DASHBOARD}
      actions={<EditToggle editing={editing} onChange={setEditing} label="Edit my routines" />}
    >
      {editing ? (
        <RoutineEditor
          target={{ kind: "self" }}
          load={load}
          emptyText="No routines yet. A morning or wind-down routine is a good place to start."
          pausedNote="Paused: not shown on your day"
        />
      ) : (
        <MyRoutines session={session} emptyText={'No routines for this day. Choose "Edit my routines" to add one.'} />
      )}
    </MyToolsShell>
  );
};

export const IndividualJournalPage: React.FC = () => {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <MyToolsShell title="My journal" subtitle="Only you can read this." backTo={ROUTES.DASHBOARD}>
      <MyJournal session={session} />
    </MyToolsShell>
  );
};

export const IndividualRemindersPage: React.FC = () => {
  const { session } = useAuth();
  const [editing, setEditing] = useEditMode();
  const loadReminders = useCallback(() => listReminders(session), [session]);
  const loadRoutines = useCallback(() => listMyRoutineSetup(session), [session]);
  if (!session) return null;
  return (
    <MyToolsShell
      title={editing ? "Set up my reminders" : "My reminders"}
      subtitle="Shown here while SafeSpace is open. Nothing is sent to your phone."
      backTo={ROUTES.DASHBOARD}
      actions={<EditToggle editing={editing} onChange={setEditing} label="Edit my reminders" />}
    >
      {editing ? (
        <ReminderEditor
          target={{ kind: "self" }}
          loadReminders={loadReminders}
          loadRoutines={loadRoutines}
          livesElsewhereHint="if you're travelling"
        />
      ) : (
        <MyReminders session={session} />
      )}
    </MyToolsShell>
  );
};

export const IndividualCompanionPage: React.FC = () => {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <MyToolsShell title="AI Companion" backTo={ROUTES.DASHBOARD}>
      <ChatWindow session={session} />
    </MyToolsShell>
  );
};
