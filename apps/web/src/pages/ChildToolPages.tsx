import React from "react";
import { ChildPageShell, childModuleKeys, useChildSpace } from "../features/child-space";
import { MyJournal, MyReminders, MyRoutines, journalVisibilityNote } from "../features/my-tools";
import { ChatWindow } from "../features/ai-companion";
import { ModulesRoutes } from "../features/wellness-modules";
import { ROUTES } from "../routes";

// The child's tool pages (docs/role-flow/CONTRACT.md section 3, D2). Each
// uses the shared screen with the child's session and session-ended guard.

export const ChildRoutinesPage: React.FC = () => {
  const { session, guard } = useChildSpace();
  return (
    <ChildPageShell title="My routines" backTo={ROUTES.CHILD_HOME}>
      <MyRoutines session={session} guard={guard} emptyText="No routines for this day. Your grown-up sets these up." />
    </ChildPageShell>
  );
};

export const ChildJournalPage: React.FC = () => {
  const { session, guard, settings } = useChildSpace();
  return (
    <ChildPageShell title="My journal" backTo={ROUTES.CHILD_HOME}>
      <MyJournal session={session} guard={guard} visibilityNote={journalVisibilityNote(settings.sharing)} />
    </ChildPageShell>
  );
};

export const ChildRemindersPage: React.FC = () => {
  const { session, guard } = useChildSpace();
  return (
    <ChildPageShell title="My reminders" backTo={ROUTES.CHILD_HOME}>
      <MyReminders session={session} guard={guard} />
    </ChildPageShell>
  );
};

export const ChildCompanionPage: React.FC = () => {
  const { session } = useChildSpace();
  return (
    <ChildPageShell title="AI Companion" backTo={ROUTES.CHILD_HOME}>
      <ChatWindow session={session} />
      <p className="text-xs text-charcoal/70">
        The AI Companion is a computer, not a person. If you feel unsafe, tell a grown-up you trust.
      </p>
    </ChildPageShell>
  );
};

// Thrisha's wellness modules, for the modules a caregiver assigned.
export const ChildModulesPage: React.FC = () => {
  const { child } = useChildSpace();
  return (
    <ModulesRoutes
      basePath={ROUTES.CHILD_MODULES}
      homePath={ROUTES.CHILD_HOME}
      onlyKeys={childModuleKeys(child.assignedModules)}
      showStoryWorkflow={false}
    />
  );
};
