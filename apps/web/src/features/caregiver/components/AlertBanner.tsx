import React from "react";
import { Link } from "react-router-dom";
import { alertBannerText } from "../alertsView";
import { useAlerts } from "../useAlerts";

interface Props {
  alertsPath: string;
}

// Red banner on the caregiver home while any alert is unreviewed
// (docs/role-flow/CONTRACT.md P4). Disappears once every alert is reviewed.
export const AlertBanner: React.FC<Props> = ({ alertsPath }) => {
  const { alerts } = useAlerts(true);
  const text = alertBannerText(alerts ?? []);
  if (!text) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span className="font-medium">{text}</span>
      <Link
        to={alertsPath}
        className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        Review alerts
      </Link>
    </div>
  );
};
