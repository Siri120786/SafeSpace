import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createCaregiverInvite, listChildCaregivers, removeChildCaregiver } from "@safespace/api-client";
import type { CaregiverInvite, ChildCaregiver } from "@safespace/shared-types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAuth } from "../features/auth";
import {
  CaregiverPageShell,
  ConfirmButton,
  canDo,
  caregiverChildPath,
  formatInviteCode,
  inviteExpiryText,
  manageErrorText,
  useCaregiverChild,
} from "../features/caregiver";
import { ROUTES } from "../routes";

// /caregiver/children/:childId/caregivers: who looks after this child.
// The primary invites and removes; a co-caregiver can leave
// (docs/role-flow/CONTRACT.md section 4). No emails are sent.
export const CaregiverChildCaregiversPage: React.FC = () => {
  const { childId = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const myId = session?.kind === "auth_user" ? session.profile.id : "";
  const { child, error: childError } = useCaregiverChild(childId);
  const [people, setPeople] = useState<ChildCaregiver[] | null>(null);
  const [invite, setInvite] = useState<CaregiverInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setPeople(await listChildCaregivers(childId));
    } catch (e) {
      setError(manageErrorText(e));
    }
  }, [childId]);

  useEffect(() => {
    if (child) reload();
  }, [child, reload]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(manageErrorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the code is on screen.
    }
  }

  if (childError === "not_found") {
    return (
      <CaregiverPageShell title="Child not found" backTo={ROUTES.CAREGIVER_HOME}>
        <Card><p className="text-textBody">This child isn't one of yours, or no longer is.</p></Card>
      </CaregiverPageShell>
    );
  }

  const name = child?.name ?? "";
  const role = child?.myRole;
  return (
    <CaregiverPageShell
      title={child ? `Who looks after ${name}` : "Caregivers"}
      subtitle="Each caregiver has their own account and sees the same alerts, routines and activity."
      backTo={caregiverChildPath(childId)}
      backLabel={child ? `Back to ${name}` : "Back"}
    >
      {(error || childError === "failed") && <p role="alert" className="text-sm text-red-700">{error ?? "Couldn't load this child right now."}</p>}

      <Card className="p-6 border border-olive-100">
        {people === null ? (
          <p className="text-textBody">Loading...</p>
        ) : (
          <ul className="divide-y divide-olive-100">
            {people.map((p) => {
              const isMe = p.caregiverId === myId;
              return (
                <li key={p.caregiverId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-textHeading">{p.displayName || "Caregiver"}{isMe && " (you)"}</p>
                    <p className="text-xs text-textMuted">{p.role === "primary" ? "Primary caregiver" : "Co-caregiver"}</p>
                  </div>
                  {canDo(role, "remove_caregiver") && p.role === "co_caregiver" && (
                    <ConfirmButton
                      label="Remove"
                      confirmLabel={`Remove ${p.displayName || "this caregiver"}`}
                      disabled={busy}
                      onConfirm={async () => { if (await act(() => removeChildCaregiver(childId, p.caregiverId))) await reload(); }}
                    />
                  )}
                  {isMe && canDo(role, "leave") && (
                    <ConfirmButton
                      label={`Stop looking after ${name}`}
                      confirmLabel="Yes, leave"
                      disabled={busy}
                      onConfirm={async () => {
                        if (await act(() => removeChildCaregiver(childId, myId))) navigate(ROUTES.CAREGIVER_HOME, { replace: true });
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {people && canDo(role, "remove_caregiver") && (
          <p className="text-xs text-textMuted mt-2">Removing someone ends their access straight away.</p>
        )}
      </Card>

      {canDo(role, "invite") ? (
        <Card className="p-6 space-y-3 border border-olive-100">
          <h2 className="font-display text-lg font-medium text-textHeading">Invite another caregiver</h2>
          <p className="text-sm text-textBody">
            Give them a one-time code. They sign up or sign in as a caregiver, choose "Join with a code", and enter it.
          </p>
          {invite ? (
            <div className="rounded-2xl border border-olive-200 bg-olive-50/70 px-4 py-3 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl tracking-[0.15em] text-textHeading" aria-live="polite">{formatInviteCode(invite.code)}</span>
                <button type="button" onClick={copy} className="text-xs font-medium text-deepGreen underline">{copied ? "Copied" : "Copy"}</button>
              </div>
              <p className="text-xs text-textMuted">{inviteExpiryText(invite.expiresAt)} It won't be shown again, so share it now.</p>
            </div>
          ) : (
            <Button variant="olive" size="sm" disabled={busy || !child} onClick={() => act(async () => setInvite(await createCaregiverInvite(childId)))}>
              Create an invite code
            </Button>
          )}
        </Card>
      ) : (
        role && (
          <Card className="p-6 border border-olive-100">
            <p className="text-sm text-textBody">Only the primary caregiver can invite or remove caregivers.</p>
          </Card>
        )
      )}
    </CaregiverPageShell>
  );
};

export default CaregiverChildCaregiversPage;
