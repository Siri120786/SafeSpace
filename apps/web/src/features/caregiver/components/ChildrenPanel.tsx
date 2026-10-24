import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyChildren, getChildFamilyCode } from "@safespace/api-client";
import type { Child } from "@safespace/shared-types";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { ChildOverviewCard } from "./ChildOverviewCard";

interface Props {
  addChildPath: string;
  joinPath: string;
}

// Every child the caregiver cares for, each with the family code their device
// needs. A child always signs in with their primary caregiver's code, so a
// co-caregiver sees the primary's code here, not their own
// (docs/role-flow/CONTRACT.md section 4). RLS limits every read to the caller's children.
export const ChildrenPanel: React.FC<Props> = ({ addChildPath, joinPath }) => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [codes, setCodes] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const kids = await listMyChildren();
      setChildren(kids);
      const pairs = await Promise.all(
        kids.map(async (k) => [k.id, await getChildFamilyCode(k.id).catch(() => null)] as const),
      );
      setCodes(Object.fromEntries(pairs));
    } catch {
      setError("Couldn't load your children right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-medium text-textHeading">Your children</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(joinPath)}>
            Join with a code
          </Button>
          <Button variant="olive" size="sm" onClick={() => navigate(addChildPath)}>
            Add child
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-textBody">Loading your children...</p>}

      {!loading && !error && children.length === 0 && (
        <Card>
          <p className="text-textBody">
            No children yet. Add a child to give them their own Child Space, or join a child another caregiver
            added with an invite code.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map((c) => (
          <ChildOverviewCard key={c.id} child={c} familyCode={codes[c.id] ?? null} />
        ))}
      </div>

      {children.length > 0 && (
        <p className="text-xs text-textMuted">
          These are activity counts from the last 7 days, not an assessment.
        </p>
      )}
    </div>
  );
};
