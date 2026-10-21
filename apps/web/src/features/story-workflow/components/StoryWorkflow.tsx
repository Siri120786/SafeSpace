import React, { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { CalmToolShell } from "../../calm-tools/components/CalmToolShell";
import {
  BODY_MAX,
  STATUS_LABELS,
  TITLE_MAX,
  approveStory,
  canRead,
  createDraft,
  rejectStory,
  submitForApproval,
  validateStory,
  type Story,
  type TransitionResult,
} from "../lib/storyWorkflow";

interface StoryWorkflowProps {
  isCaregiver: boolean;
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
}

const fieldClass =
  "w-full rounded-2xl border border-olive-200 bg-white px-4 py-3 text-base text-textBody focus:outline-none focus:ring-2 focus:ring-olive-500";

export const StoryWorkflow: React.FC<StoryWorkflowProps> = ({ isCaregiver, lowSensory, onExit, notice }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Story | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [counter, setCounter] = useState(1);

  const apply = (id: string, result: TransitionResult) => {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setStories((list) => list.map((s) => (s.id === id ? result.story : s)));
    return true;
  };

  if (!isCaregiver) {
    return (
      <CalmToolShell title="Story workflow" onExit={onExit} lowSensory={lowSensory} notice={notice}>
        <Card>
          <p role="status" className="text-base text-textBody">
            Writing and approving stories is for caregivers. Please ask the caregiver who looks after you.
          </p>
        </Card>
      </CalmToolShell>
    );
  }

  if (reading) {
    return (
      <CalmToolShell title={reading.title} onExit={onExit} lowSensory={lowSensory} notice={notice}>
        <Card className="space-y-6">
          <p className="text-lg leading-relaxed text-textBody whitespace-pre-wrap">{reading.body}</p>
          <Button variant="outline" onClick={() => setReading(null)}>
            Back to stories
          </Button>
        </Card>
      </CalmToolShell>
    );
  }

  const saveDraft = () => {
    const issues = validateStory(title, body);
    if (issues.length > 0) {
      setError(issues[0]);
      return;
    }
    setStories((list) => [...list, createDraft(`story-${counter}`, title, body)]);
    setCounter((c) => c + 1);
    setTitle("");
    setBody("");
    setError(null);
  };

  return (
    <CalmToolShell title="Story workflow" onExit={onExit} lowSensory={lowSensory} notice={notice}>
      <div className="space-y-6">
        <p role="note" className="rounded-2xl bg-white/80 border border-olive-200 px-4 py-3 text-sm text-textBody">
          Prototype: stories are kept only while this page is open and are not saved yet. The checks here are basic and the wording
          still needs human review.
        </p>

        <Card className="space-y-4">
          <h2 className="font-display text-xl text-textHeading">Write a draft</h2>
          <div>
            <label htmlFor="story-title" className="block text-sm text-textBody mb-1">
              Title
            </label>
            <input id="story-title" className={fieldClass} value={title} maxLength={TITLE_MAX + 20} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="story-body" className="block text-sm text-textBody mb-1">
              Story ({body.trim().length}/{BODY_MAX})
            </label>
            <textarea id="story-body" rows={6} className={fieldClass} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={saveDraft}>
            Save draft
          </Button>
        </Card>

        <section aria-label="Stories" className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">Your stories</h2>
          {stories.length === 0 && <p className="text-sm text-textMuted">No stories yet. Write a draft above.</p>}
          {stories.map((s) => (
            <Card key={s.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg text-textHeading">{s.title}</h3>
                <span className="text-xs font-semibold text-deepGreen bg-olive-50 px-3 py-1 rounded-full">{STATUS_LABELS[s.status]}</span>
              </div>
              {s.status === "rejected" && s.rejectionReason && (
                <p className="text-sm text-textBody">Reason: {s.rejectionReason}</p>
              )}
              <div className="flex flex-wrap gap-3">
                {(s.status === "draft" || s.status === "rejected") && (
                  <Button size="sm" variant="primary" onClick={() => apply(s.id, submitForApproval(s))}>
                    Send for approval
                  </Button>
                )}
                {s.status === "pending_approval" && (
                  <>
                    <Button size="sm" variant="primary" onClick={() => apply(s.id, approveStory(s, isCaregiver))}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectingId(rejectingId === s.id ? null : s.id)}>
                      Ask for changes
                    </Button>
                  </>
                )}
                {canRead(s) && (
                  <Button size="sm" variant="olive" onClick={() => setReading(s)}>
                    Read story
                  </Button>
                )}
              </div>
              {rejectingId === s.id && (
                <div className="space-y-2">
                  <label htmlFor={`reason-${s.id}`} className="block text-sm text-textBody">
                    What should change?
                  </label>
                  <input id={`reason-${s.id}`} className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      if (apply(s.id, rejectStory(s, isCaregiver, reason))) {
                        setRejectingId(null);
                        setReason("");
                      }
                    }}
                  >
                    Send feedback
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </section>
      </div>
    </CalmToolShell>
  );
};
