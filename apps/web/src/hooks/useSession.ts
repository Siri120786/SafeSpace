import { useEffect, useState } from "react";
import { getExistingSession } from "@safespace/api-client";
import type { AppSession } from "@safespace/shared-types";
import { getStoredChildSession } from "../lib/childSessionStorage";

export function useSession() {
  const [session, setSession] = useState<AppSession>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const caregiverSession = await getExistingSession();
      if (caregiverSession) {
        setSession(caregiverSession);
        setLoading(false);
        return;
      }
      const childSession = getStoredChildSession();
      if (childSession) {
        setSession(childSession);
        setLoading(false);
        return;
      }
      setLoading(false);
    })();
  }, []);

  return { session, setSession, loading };
}
