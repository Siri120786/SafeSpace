// packages/api-client/src/childDetail.ts
// Caregiver child detail page (docs/role-flow/CONTRACT.md sections 5 and 9).
// Everything is read with the caregiver's own RLS: the caller must be one of
// the child's caregivers, or the child is `not_found`.
//
// Activity (moods, journal, AI chats, the summary) is gated by the age-15
// sharing rule. When the young person has chosen not to share, those reads are
// skipped and come back as null, so the page says so instead of showing an
// empty history; RLS hides the rows anyway. What caregivers set up (routines,
// reminders) and alerts are never gated.
//
// AI chats are read-only here: caregivers can't send, edit or delete them.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, toContractError } from "./edge";
import { CHILD_COLUMNS, currentUserId, toChild, type ChildRow } from "./children";
import { activityVisibility } from "./childSharing";
import { getChildWellnessSummary } from "./wellness";
import { listChildMoodCheckins } from "./mood";
import { listChildJournalEntries } from "./journal";
import { listChildRoutines } from "./routines";
import { listChildReminders } from "./reminders";
import type {
  AiCompanionConversation,
  AiCompanionMessage,
  CaregiverChildDetail,
  LanguageCode,
  WellnessPeriodDays,
} from "@safespace/shared-types";

export const CHILD_DETAIL_RECENT_LIMIT = 20;
const AI_MESSAGES_LIMIT = 200;

interface ConversationRow {
  id: string;
  child_id: string | null;
  title: string;
  language: LanguageCode;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender: "user" | "assistant";
  content: string;
  detected_language: LanguageCode | null;
  is_safety_response: boolean;
  created_at: string;
}

function toConversation(r: ConversationRow): AiCompanionConversation {
  return {
    id: r.id,
    profileId: null,
    childId: r.child_id,
    preferredLanguage: r.language,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toMessage(r: MessageRow, fallback: LanguageCode): AiCompanionMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    sender: r.sender,
    content: r.content,
    language: r.detected_language ?? fallback,
    isSafetyResponse: r.is_safety_response,
    createdAt: r.created_at,
  };
}

// "YYYY-MM-DD" in the viewer's local time.
function localDate(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** A child's AI Companion conversations, most recently active first (read-only). */
export async function listChildAiConversations(
  childId: string,
  options: { limit?: number } = {},
): Promise<AiCompanionConversation[]> {
  const limit = options.limit ?? CHILD_DETAIL_RECENT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ContractError("invalid_input");
  const { data, error } = await getSafeSpaceClient()
    .from("ai_companion_conversations")
    .select("id, child_id, title, language, created_at, updated_at")
    .eq("child_id", childId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw toContractError(error);
  return ((data ?? []) as ConversationRow[]).map(toConversation);
}

/**
 * Messages of one of the child's conversations, oldest first (read-only).
 * `not_found` when the conversation isn't this child's or isn't visible.
 */
export async function getChildAiMessages(childId: string, conversationId: string): Promise<AiCompanionMessage[]> {
  const supabase = getSafeSpaceClient();
  const { data: conv, error: convError } = await supabase
    .from("ai_companion_conversations")
    .select("id, language")
    .eq("id", conversationId)
    .eq("child_id", childId)
    .maybeSingle();
  if (convError) throw toContractError(convError);
  if (!conv) throw new ContractError("not_found");

  const { data, error } = await supabase
    .from("ai_companion_messages")
    .select("id, conversation_id, sender, content, detected_language, is_safety_response, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(AI_MESSAGES_LIMIT);
  if (error) throw toContractError(error);
  return ((data ?? []) as MessageRow[]).map((m) => toMessage(m, (conv as { language: LanguageCode }).language));
}

/** Everything the caregiver child detail page shows, as sharing allows. */
export async function getChildDetail(
  childId: string,
  periodDays: WellnessPeriodDays,
  options: { now?: Date } = {},
): Promise<CaregiverChildDetail> {
  const supabase = getSafeSpaceClient();
  const now = options.now ?? new Date();
  const { data, error } = await supabase.from("children").select(CHILD_COLUMNS).eq("id", childId).maybeSingle();
  if (error) throw toContractError(error);
  if (!data) throw new ContractError("not_found"); // not one of the caller's children

  const child = toChild(data as ChildRow, await currentUserId(), now);
  const activity = activityVisibility(child.sharing);

  // Never gated: alerts, and what caregivers set up.
  const [alertCount, routines, reminders] = await Promise.all([
    supabase.from("emergency_events").select("id", { count: "exact", head: true })
      .eq("child_id", childId).is("reviewed_at", null),
    listChildRoutines(childId, { date: localDate(now) }),
    listChildReminders(childId),
  ]);
  if (alertCount.error) throw toContractError(alertCount.error);

  const base = {
    child,
    ageYears: child.ageYears,
    sharing: child.sharing,
    myRole: child.myRole ?? "co_caregiver",
    unreviewedAlerts: alertCount.count ?? 0,
    activity,
    periodDays,
    routines,
    reminders,
  };
  if (!activity.visible) {
    return { ...base, summary: null, recentMoods: null, recentJournal: null, aiConversations: null };
  }

  const [summary, recentMoods, recentJournal, aiConversations] = await Promise.all([
    getChildWellnessSummary(childId, periodDays),
    listChildMoodCheckins(childId, { limit: CHILD_DETAIL_RECENT_LIMIT }),
    listChildJournalEntries(childId, { limit: CHILD_DETAIL_RECENT_LIMIT }),
    listChildAiConversations(childId),
  ]);
  return { ...base, summary, recentMoods, recentJournal, aiConversations };
}
