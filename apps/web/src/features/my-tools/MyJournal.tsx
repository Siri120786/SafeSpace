import React, { useCallback, useEffect, useState } from "react";
import { createJournalEntry, deleteJournalEntry, listMyJournalEntries } from "@safespace/api-client";
import { JOURNAL_CONTENT_MAX_LENGTH, type AppSession, type JournalEntry, type JournalEntryType } from "@safespace/shared-types";
import { validateJournal } from "./toolsLogic";
import { MicButton, ReadAloudButton, appendTranscript } from "../speech";
import type { Guard } from "./MyRoutines";

interface Props {
  session: AppSession;
  guard?: Guard;
  visibilityNote?: string | null; // a child is told who can read it
}

const TYPES: { key: JournalEntryType; label: string; prompt: string }[] = [
  { key: "journal", label: "Journal", prompt: "What's on your mind?" },
  { key: "gratitude", label: "Thankful for", prompt: "Something you're thankful for today" },
];

// Write and read your own journal. Only adults can delete entries
// (children can't delete, per the journal contract).
export const MyJournal: React.FC<Props> = ({ session, guard = (p) => p, visibilityNote }) => {
  const [type, setType] = useState<JournalEntryType>("journal");
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const canDelete = session?.kind === "auth_user";

  const load = useCallback(async () => {
    try {
      setEntries(await guard(listMyJournalEntries(session, { limit: 30 })));
    } catch {
      setMessage({ ok: false, text: "Couldn't load your journal right now." });
    }
  }, [session, guard]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateJournal(content);
    if (problem) return setMessage({ ok: false, text: problem });
    setSaving(true);
    setMessage(null);
    try {
      await guard(createJournalEntry(session, { content: content.trim(), entryType: type }));
      setContent("");
      setMessage({ ok: true, text: "Saved." });
      await load();
    } catch {
      setMessage({ ok: false, text: "That didn't save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setConfirming(null);
    try {
      await guard(deleteJournalEntry(session, id));
      await load();
    } catch {
      setMessage({ ok: false, text: "Couldn't delete that entry." });
    }
  }

  const prompt = TYPES.find((t) => t.key === type)!.prompt;
  return (
    <div className="space-y-4">
      <form onSubmit={save} className="rounded-3xl bg-white p-5 shadow-card space-y-3">
        <div role="group" aria-label="Kind of entry" className="flex gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={type === t.key}
              onClick={() => setType(t.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${type === t.key ? "bg-botanical-700 text-white" : "bg-ivory-100 text-charcoal"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="mt-0 block text-sm font-semibold text-charcoal">
          {prompt}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={JOURNAL_CONTENT_MAX_LENGTH}
            rows={5}
            className="mt-1 block w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-base font-normal"
          />
        </label>
        <MicButton onText={(spoken) => setContent((c) => appendTranscript(c, spoken, JOURNAL_CONTENT_MAX_LENGTH))} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-charcoal/70">{visibilityNote}</span>
          <button type="submit" disabled={saving} className="rounded-full bg-botanical-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-botanical-800" : "text-red-700"}`}>{message.text}</p>}
      </form>

      {entries === null ? (
        <p className="text-sm">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-3xl bg-white p-5 text-base shadow-card">Nothing written yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((j) => (
            <li key={j.id} className="rounded-3xl bg-white p-5 shadow-card space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs text-charcoal/70">
                <span>
                  {j.entryType === "gratitude" ? "Thankful for · " : ""}
                  {new Date(j.createdAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="flex items-center gap-2">
                <ReadAloudButton text={j.content} label="Read this entry aloud" />
                {canDelete && (confirming === j.id ? (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => remove(j.id)} className="font-semibold text-red-700 underline">Delete it</button>
                    <button type="button" onClick={() => setConfirming(null)} className="underline">Keep</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirming(j.id)} className="underline">Delete</button>
                ))}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-base text-charcoal">{j.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
