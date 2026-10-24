// packages/api-client/src/music.ts
// Music (role-flow 9b): hearted tracks and the links to hosted song files.
//   - a child's favorites go through the `focus-tools` Edge Function, which
//     touches only that child's rows;
//   - an adult (Individual) keeps their own under RLS.
// Caregivers can't read anyone's favorites, and nothing about listening is
// recorded. A child's music controls come with the tool settings
// (getToolSettings / setChildToolSettings).
// Errors: invalid_input, limit_reached, invalid_session, unsupported_session.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, toContractError } from "./edge";
import type { AppSession } from "@safespace/shared-types";

export const MUSIC_BUCKET = "music";
const TRACK_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

function fail(error: { code?: string; message?: string }): never {
  if (error.message?.includes("limit_reached")) throw new ContractError("limit_reached");
  throw toContractError(error);
}

// The hearted track ids, newest first.
export async function listMusicFavorites(session: AppSession): Promise<string[]> {
  if (session?.kind === "child") {
    return (await invokeEdge<{ trackIds: string[] }>("focus-tools", {
      action: "favorites.list", child_session_token: session.childSessionToken,
    })).trackIds;
  }
  if (session?.kind !== "auth_user" || !session.profile?.id) throw new ContractError("unsupported_session");
  const { data, error } = await getSafeSpaceClient().from("music_favorites").select("track_id")
    .eq("profile_id", session.profile.id).order("created_at", { ascending: false });
  if (error) fail(error);
  return (data ?? []).map((r: { track_id: string }) => r.track_id);
}

// Heart or un-heart a track. Doing it twice is fine.
export async function setMusicFavorite(session: AppSession, trackId: string, favorite: boolean): Promise<void> {
  if (!TRACK_ID.test(trackId)) throw new ContractError("invalid_input");
  if (session?.kind === "child") {
    await invokeEdge("focus-tools", {
      action: favorite ? "favorites.add" : "favorites.remove", child_session_token: session.childSessionToken, track_id: trackId,
    });
    return;
  }
  if (session?.kind !== "auth_user" || !session.profile?.id) throw new ContractError("unsupported_session");
  const db = getSafeSpaceClient().from("music_favorites");
  const { error } = favorite
    ? await db.upsert({ profile_id: session.profile.id, track_id: trackId }, { onConflict: "profile_id,track_id", ignoreDuplicates: true })
    : await db.delete().eq("profile_id", session.profile.id).eq("track_id", trackId);
  if (error) fail(error);
}

// The public link to a hosted song file (a path inside the music bucket).
export function musicFileUrl(path: string): string {
  return getSafeSpaceClient().storage.from(MUSIC_BUCKET).getPublicUrl(path).data.publicUrl;
}
