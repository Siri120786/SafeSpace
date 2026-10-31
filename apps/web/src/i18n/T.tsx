import React from "react";
import { useTranslation } from "react-i18next";

// A translated piece of text, for places that can't call the hook themselves
// (plain helper functions in the theme kits). It re-renders on its own when
// the language changes.
export const T: React.FC<{ k: string; values?: Record<string, unknown> }> = ({ k, values }) => {
  const { t } = useTranslation();
  return <>{t(k, values)}</>;
};

export default T;
