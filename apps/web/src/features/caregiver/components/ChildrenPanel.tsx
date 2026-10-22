import React, { useCallback, useEffect, useState } from "react";
import { listMyChildren, getMyFamilyCode } from "@safespace/api-client";
import type { Child } from "@safespace/shared-types";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { ChildOverviewCard } from "./ChildOverviewCard";
import { AddChildForm } from "./AddChildForm";

// The caregiver's children: the family code a child's device needs, one
// overview card per child, and adding a child. RLS limits every read to the
// signed-in caregiver's own family.
export const ChildrenPanel: React.FC = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [kids, code] = await Promise.all([listMyChildren(), getMyFamilyCode()]);
      setChildren(kids);
      setFamilyCode(code);
    } catch {
      setError("Couldn't load your family right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyCode() {
    if (!familyCode) return;
    try {
      await navigator.clipboard.writeText(familyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the code is still on screen.
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-olive-50/80 via-white to-paleLime/40 border border-olive-200/60">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen">Family code</span>
          <div className="font-display text-3xl font-medium tracking-[0.2em] text-textHeading mt-1" aria-live="polite">
            {familyCode ?? "······"}
          </div>
          <p className="text-xs text-textMuted mt-1">
            On your child's device, open Child Space and enter this code with their PIN.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copyCode} disabled={!familyCode}>
          {copied ? "Copied" : "Copy code"}
        </Button>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-medium text-textHeading">Your children</h2>
        {!adding && (
          <Button variant="olive" size="sm" onClick={() => setAdding(true)}>
            Add child
          </Button>
        )}
      </div>

      {adding && (
        <AddChildForm
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-textBody">Loading your family...</p>}

      {!loading && !error && children.length === 0 && !adding && (
        <Card>
          <p className="text-textBody">No children added yet. Add a child to give them their own Child Space.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map((c) => (
          <ChildOverviewCard key={c.id} child={c} />
        ))}
      </div>

      <p className="text-xs text-textMuted">
        These are activity counts from the last 7 days, not an assessment.
      </p>
    </div>
  );
};
