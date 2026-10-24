import React from "react";
import { useParams } from "react-router-dom";
import { ChildPageShell } from "../features/child-space";
import { MyToolsShell } from "../features/my-tools";
import { MusicCredits, MusicLibrary, PlaylistView, usePlaylist } from "../features/music";
import { ROUTES } from "../routes";

// Music (role-flow 9a/9b): the library, one page per playlist (and the
// person's favorites), and the credits, for children and for Individuals.

// /child/music
export const ChildMusicPage: React.FC = () => (
  <ChildPageShell title="Music" backTo={ROUTES.CHILD_HOME}>
    <MusicLibrary base={ROUTES.CHILD_MUSIC} tone="child" />
  </ChildPageShell>
);

// /child/music/:playlistId
export const ChildPlaylistPage: React.FC = () => {
  const { playlistId } = useParams();
  const playlist = usePlaylist(playlistId);
  return (
    <ChildPageShell title={playlist?.title ?? "Music"} backTo={ROUTES.CHILD_MUSIC}>
      {playlist ? (
        <PlaylistView playlist={playlist} tone="child" />
      ) : (
        <p className="rounded-3xl bg-white p-5 shadow-card">That playlist isn't here. Pick another one.</p>
      )}
    </ChildPageShell>
  );
};

// /child/music/credits
export const ChildMusicCreditsPage: React.FC = () => (
  <ChildPageShell title="Music credits" backTo={ROUTES.CHILD_MUSIC}>
    <MusicCredits />
  </ChildPageShell>
);

// /music
export const IndividualMusicPage: React.FC = () => (
  <MyToolsShell title="Music" subtitle="Calm sounds and gentle tunes for resting, settling, cheering up and focusing." backTo={ROUTES.DASHBOARD}>
    <MusicLibrary base={ROUTES.MUSIC} tone="adult" />
  </MyToolsShell>
);

// /music/:playlistId
export const IndividualPlaylistPage: React.FC = () => {
  const { playlistId } = useParams();
  const playlist = usePlaylist(playlistId);
  return (
    <MyToolsShell title={playlist?.title ?? "Music"} subtitle={playlist ? undefined : "That playlist isn't here."} backTo={ROUTES.MUSIC} backLabel="Back to Music">
      {playlist && <PlaylistView playlist={playlist} tone="adult" />}
    </MyToolsShell>
  );
};

// /music/credits
export const IndividualMusicCreditsPage: React.FC = () => (
  <MyToolsShell title="Music credits" subtitle="Who made the music, and the terms it's used under." backTo={ROUTES.MUSIC} backLabel="Back to Music">
    <MusicCredits />
  </MyToolsShell>
);
