import React, { useEffect, useState } from "react";
import { listLinkedUsers, getLinkedUserProfile } from "@safespace/api-client";
import type { LinkedUser, LinkedUserProfileView } from "@safespace/shared-types";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { LinkedUserProfile } from "./LinkedUserProfile";

interface Props {
  caregiverId: string;
}

export const LinkedUsersPanel: React.FC<Props> = ({ caregiverId }) => {
  const [users, setUsers] = useState<LinkedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LinkedUserProfileView | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let active = true;
    listLinkedUsers(caregiverId)
      .then((r) => active && setUsers(r))
      .catch((e: unknown) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [caregiverId]);

  async function openUser(userId: string) {
    setOpening(true);
    setError(null);
    try {
      const view = await getLinkedUserProfile(userId);
      if (!view) {
        setError("You don't have access to this profile.");
        return;
      }
      setSelected(view);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }

  if (selected) {
    return <LinkedUserProfile view={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-textHeading">Linked users</h2>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-textBody">Loading linked users...</p>}

      {!loading && users.length === 0 && (
        <Card>
          <p className="text-textBody">No linked users yet.</p>
        </Card>
      )}

      {users.map((u) => (
        <Card key={u.linkId} className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-textHeading">
              {u.displayName || "Unnamed user"}
            </div>
            <div className="text-sm text-textBody">
              Onboarding: {u.onboardingState === "completed" ? "Completed" : "Not completed yet"}
            </div>
          </div>
          <Button size="sm" variant="olive" disabled={opening} onClick={() => openUser(u.userId)}>
            View profile
          </Button>
        </Card>
      ))}
    </div>
  );
};
