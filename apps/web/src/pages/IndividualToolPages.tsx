import React from "react";
import { useAuth } from "../features/auth";
import { MyJournal, MyReminders, MyRoutines, MyToolsShell } from "../features/my-tools";
import { ChatWindow } from "../features/ai-companion";
import { ROUTES } from "../routes";

// An Individual's own tool pages (docs/role-flow/CONTRACT.md section 3, D2).
// RoleRoute only lets Individuals in, so the session is theirs.

export const IndividualRoutinesPage: React.FC = () => {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <MyToolsShell title="My routines" subtitle="Tick off steps as you go, for today or the last few days." backTo={ROUTES.DASHBOARD}>
      <MyRoutines session={session} emptyText="No routines for this day yet." />
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
  if (!session) return null;
  return (
    <MyToolsShell title="My reminders" subtitle="Shown here while SafeSpace is open. Nothing is sent to your phone." backTo={ROUTES.DASHBOARD}>
      <MyReminders session={session} />
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
