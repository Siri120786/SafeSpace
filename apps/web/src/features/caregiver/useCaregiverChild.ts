import { useCallback, useEffect, useState } from "react";
import { listMyChildren } from "@safespace/api-client";
import type { Child } from "@safespace/shared-types";

// One of the signed-in caregiver's children by id; "not_found" when it isn't
// theirs. `reload` re-reads it after a change.
export function useCaregiverChild(childId: string) {
  const [child, setChild] = useState<Child | null>(null);
  const [error, setError] = useState<"not_found" | "failed" | null>(null);

  const reload = useCallback(async () => {
    try {
      const found = (await listMyChildren()).find((k) => k.id === childId) ?? null;
      setChild(found);
      setError(found ? null : "not_found");
    } catch {
      setError("failed");
    }
  }, [childId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { child, error, reload };
}
