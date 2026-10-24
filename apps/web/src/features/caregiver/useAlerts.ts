import { useCallback, useEffect, useState } from "react";
import { listAlerts } from "@safespace/api-client";
import type { CaregiverAlert } from "@safespace/shared-types";
import { ALERT_POLL_MS } from "./alertsView";

// Alerts for all the caregiver's children, re-read every ALERT_POLL_MS while
// the page is open (and right after `reload`). In-app only.
export function useAlerts(unreviewedOnly: boolean) {
  const [alerts, setAlerts] = useState<CaregiverAlert[] | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      setAlerts(await listAlerts({ unreviewedOnly }));
      setError(false);
    } catch {
      setError(true);
    }
  }, [unreviewedOnly]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, ALERT_POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  return { alerts, error, reload };
}
