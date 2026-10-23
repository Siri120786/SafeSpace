import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChildPageShell, useChildSpace } from "../features/child-space";
import { STORY_LIBRARY, StoryPlayer, estimateStorySeconds, findLibraryStory } from "../features/stories";
import { ROUTES } from "../routes";

const storyPath = (id: string) => `${ROUTES.CHILD_STORIES}/${encodeURIComponent(id)}`;

// /child/stories: the stories this child can watch.
export const ChildStoriesPage: React.FC = () => (
  <ChildPageShell title="Stories" backTo={ROUTES.CHILD_HOME}>
    <ul className="grid gap-3 sm:grid-cols-2">
      {STORY_LIBRARY.map((s) => (
        <li key={s.id}>
          <Link
            to={storyPath(s.id)}
            className="block rounded-3xl bg-white p-5 shadow-card focus:outline-none focus:ring-2 focus:ring-botanical-700"
          >
            <span aria-hidden="true" className="text-3xl">📖</span>
            <span className="mt-1 block font-display text-xl font-bold text-charcoal">{s.title.en}</span>
            <span className="block text-sm text-charcoal/70">{s.summary.en}</span>
            <span className="mt-2 block text-xs font-semibold text-botanical-800">
              About {Math.max(1, Math.round(estimateStorySeconds(s, "en") / 60))} minutes · English and తెలుగు
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </ChildPageShell>
);

// /child/stories/:storyId: one story in the player.
export const ChildStoryPage: React.FC = () => {
  const { storyId = "" } = useParams();
  const navigate = useNavigate();
  const { lowSensory } = useChildSpace();
  const story = findLibraryStory(storyId);
  if (!story) {
    return (
      <ChildPageShell title="Stories" backTo={ROUTES.CHILD_STORIES}>
        <p className="rounded-3xl bg-white p-5 shadow-card">That story isn't here. Pick another one.</p>
      </ChildPageShell>
    );
  }
  return (
    <ChildPageShell title={story.title.en} backTo={ROUTES.CHILD_STORIES}>
      <StoryPlayer story={story} lowSensory={lowSensory} onExit={() => navigate(ROUTES.CHILD_STORIES)} />
    </ChildPageShell>
  );
};
