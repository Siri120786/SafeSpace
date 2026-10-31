// packages/api-client/src/language.ts
// Each person's app language (English, Hindi or Telugu; migration
// 20261031200000). null means not chosen yet: the app follows the device.
//   - Adults: profiles.preferred_language, their own row under RLS.
//   - Children: through the child-settings Edge Function (set_language).

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, toContractError } from "./edge";
import { APP_LANGUAGES, type AppLanguage, type AppSession, type ChildSettings } from "@safespace/shared-types";

const isLanguage = (v: unknown): v is AppLanguage => (APP_LANGUAGES as readonly unknown[]).includes(v);

/** The signed-in person's saved language, or null if they haven't chosen. */
export async function getMyLanguage(session: AppSession): Promise<AppLanguage | null> {
  if (session?.kind === "child") {
    const data = await invokeEdge<{ settings: ChildSettings }>("child-settings", {
      action: "get",
      child_session_token: session.childSessionToken,
    });
    return isLanguage(data.settings.language) ? data.settings.language : null;
  }
  if (session?.kind === "auth_user") {
    const { data, error } = await getSafeSpaceClient()
      .from("profiles").select("preferred_language").eq("id", session.profile.id).maybeSingle();
    if (error) throw toContractError(error);
    return isLanguage(data?.preferred_language) ? data!.preferred_language : null;
  }
  throw new ContractError("unsupported_session");
}

/** Saves the signed-in person's language. */
export async function setMyLanguage(session: AppSession, language: AppLanguage): Promise<AppLanguage> {
  if (!isLanguage(language)) throw new ContractError("invalid_input");
  if (session?.kind === "child") {
    const data = await invokeEdge<{ language: AppLanguage }>("child-settings", {
      action: "set_language",
      child_session_token: session.childSessionToken,
      language,
    });
    return data.language;
  }
  if (session?.kind === "auth_user") {
    const { error } = await getSafeSpaceClient()
      .from("profiles").update({ preferred_language: language }).eq("id", session.profile.id);
    if (error) throw toContractError(error);
    return language;
  }
  throw new ContractError("unsupported_session");
}
