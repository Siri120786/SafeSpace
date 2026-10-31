import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listMyStories } from "@safespace/api-client";
import { ChildPageShell, useChildSpace } from "../features/child-space";
import {
  STORY_LIBRARY,
  StoryPlayer,
  VIDEO_STORIES,
  VideoStoryCard,
  VideoStoryPlayer,
  estimateStorySeconds,
  findLibraryStory,
  findVideoStory,
  validateStory,
  type Story,
} from "../features/stories";
import { ROUTES } from "../routes";

const storyPath = (id: string) => `${ROUTES.CHILD_STORIES}/${encodeURIComponent(id)}`;

// Stories a grown-up published to this child (role-flow 6b). Each is checked
// again before it's offered; one that doesn't pass is left out.
function usePublishedStories() {
  const { session, guard } = useChildSpace();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    guard(listMyStories<Story>(session))
      .then((list) => live && setStories(list.filter((s) => validateStory(s).length === 0)))
      .catch(() => { if (live) { setStories([]); setFailed(true); } });
    return () => { live = false; };
  }, [session, guard]);
  return { stories, failed };
}

const StoryCard: React.FC<{ story: Story; emoji: string }> = ({ story, emoji }) => {
  const mins = Math.max(1, Math.round(estimateStorySeconds(story, "en") / 60));
  return (
    <li>
      <Link
        to={storyPath(story.id)}
        className="block h-full rounded-3xl bg-white p-5 shadow-card focus:outline-none focus:ring-2 focus:ring-botanical-700"
      >
        <span aria-hidden="true" className="text-3xl">{emoji}</span>
        <span className="mt-1 block font-display text-xl font-bold text-charcoal">{story.title.en}</span>
        {story.summary.en && <span className="block text-sm text-charcoal/70">{story.summary.en}</span>}
        <span className="mt-2 block text-xs font-semibold text-botanical-800">
          About {mins} {mins === 1 ? "minute" : "minutes"} · English and తెలుగు
        </span>
      </Link>
    </li>
  );
};

// /child/stories: stories from the child's grown-ups, then the built-in ones.
export const ChildStoriesPage: React.FC = () => {
  const { stories, failed } = usePublishedStories();
  return (
    <ChildPageShell title="Stories" backTo={ROUTES.CHILD_HOME}>
      {!!stories?.length && (
        <section aria-labelledby="from-grown-ups" className="space-y-3">
          <h2 id="from-grown-ups" className="font-display text-xl font-bold text-charcoal">From your grown-ups</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {stories.map((s) => <StoryCard key={s.id} story={s} emoji="💛" />)}
          </ul>
        </section>
      )}
      {failed && <p className="text-sm text-charcoal/70">Some stories couldn't load right now. Try again later.</p>}
      <section aria-labelledby="more-stories" className="space-y-3">
        {!!stories?.length && <h2 id="more-stories" className="font-display text-xl font-bold text-charcoal">More stories</h2>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {STORY_LIBRARY.map((s) => <StoryCard key={s.id} story={s} emoji="📖" />)}
        </ul>
      </section>
      <section aria-labelledby="watch-stories" className="space-y-3">
        <h2 id="watch-stories" className="font-display text-xl font-bold text-charcoal">Watch a story</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {VIDEO_STORIES.map((s) => <VideoStoryCard key={s.id} story={s} to={storyPath(s.id)} />)}
        </ul>
      </section>
    </ChildPageShell>
  );
};

// /child/stories/:storyId: one story in the player.
export const ChildStoryPage: React.FC = () => {
  const { storyId = "" } = useParams();
  const navigate = useNavigate();
  const { lowSensory } = useChildSpace();
  const builtIn = findLibraryStory(storyId);
  const video = findVideoStory(storyId);
  const { stories } = usePublishedStories();
  if (video) {
    return (
      <ChildPageShell title={video.title} backTo={ROUTES.CHILD_STORIES}>
        <VideoStoryPlayer story={video} onExit={() => navigate(ROUTES.CHILD_STORIES)} />
      </ChildPageShell>
    );
  }
  const story = builtIn ?? stories?.find((s) => s.id === storyId) ?? null;

  if (!story) {
    return (
      <ChildPageShell title="Stories" backTo={ROUTES.CHILD_STORIES}>
        <p className="rounded-3xl bg-white p-5 shadow-card">
          {stories === null ? "Getting your story…" : "That story isn't here. Pick another one."}
        </p>
      </ChildPageShell>
    );
  }
  return (
    <ChildPageShell title={story.title.en} backTo={ROUTES.CHILD_STORIES}>
      <StoryPlayer story={story} lowSensory={lowSensory} onExit={() => navigate(ROUTES.CHILD_STORIES)} />
    </ChildPageShell>
  );
};
