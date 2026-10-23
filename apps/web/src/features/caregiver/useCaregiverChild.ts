import { useEffect, useState } from "react";
import { listMyChildren } from "@safespace/api-client";
import type { Child } from "@safespace/shared-types";

// One of the signed-in caregiver's children by id; "not_found" when it isn't theirs.
export function useCaregiverChild(childId: string) {
  const [child, setChild] = useState<Child | null>(null);
  const [error, setError] = useState<"not_found" | "failed" | null>(null);

  useEffect(() => {
    let active = true;
    listMyChildren()
      .then((kids) => {
        if (!active) return;
        const found = kids.find((k) => k.id === childId) ?? null;
        setChild(found);
        setError(found ? null : "not_found");
      })
      .catch(() => active && setError("failed"));
    return () => {
      active = false;
    };
  }, [childId]);

  return { child, error };
}
