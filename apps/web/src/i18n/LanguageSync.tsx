import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getMyLanguage, setMyLanguage } from "@safespace/api-client";
import type { AppLanguage } from "@safespace/shared-types";
import { useAuth } from "../features/auth";
import { isAppLanguage } from "./index";

// Keeps the app's language and the signed-in person's saved choice together:
// on sign-in their saved language is applied; a choice made while signed in
// is saved to their account (and on this device either way). Children save
// through the child-settings function, adults to their profile.

interface LanguageApi {
  language: AppLanguage;
  choose(language: AppLanguage): void;
}

const Ctx = createContext<LanguageApi | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const sessionKey = session?.kind === "child" ? `c:${session.childId}` : session?.kind === "auth_user" ? `p:${session.profile.id}` : null;
  const applied = useRef<string | null>(null);

  // On sign-in (or a different person), apply their saved choice if they have one.
  useEffect(() => {
    if (!session || !sessionKey || applied.current === sessionKey) return;
    applied.current = sessionKey;
    let live = true;
    getMyLanguage(session)
      .then((saved) => {
        // No saved choice yet: keep this device's language; only a real pick is saved.
        if (live && saved) void i18n.changeLanguage(saved);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [session, sessionKey, i18n]);

  const choose = useCallback((language: AppLanguage) => {
    void i18n.changeLanguage(language);
    if (session) setMyLanguage(session, language).catch(() => {});
  }, [i18n, session]);

  const language = isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
  return <Ctx.Provider value={{ language, choose }}>{children}</Ctx.Provider>;
};

export function useLanguage(): LanguageApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLanguage must be used inside LanguageProvider");
  return v;
}
