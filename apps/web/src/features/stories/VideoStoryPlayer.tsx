import React from "react";
import { Link } from "react-router-dom";
import type { VideoStory } from "./videoLibrary";

// A video story in a plain, calm player: the poster until the person presses
// play (never autoplay), the browser's own controls to pause, rewind or change
// the volume, and nothing else moving around it.
export const VideoStoryPlayer: React.FC<{ story: VideoStory; onExit?: () => void }> = ({ story, onExit }) => (
  <div className="space-y-3">
    <div className="overflow-hidden rounded-3xl bg-black shadow-card">
      <video
        src={story.video}
        poster={story.poster}
        controls
        playsInline
        preload="none"
        controlsList="nodownload"
        className="block aspect-video w-full"
        aria-label={story.title}
      />
    </div>
    <p className="text-sm text-charcoal/70">{story.summary}</p>
    {onExit && (
      <button
        type="button"
        onClick={onExit}
        className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-botanical-800 shadow-card focus:outline-none focus:ring-2 focus:ring-botanical-700"
      >
        Back to stories
      </button>
    )}
  </div>
);

// A library card for a video story: its poster, title and running time.
export const VideoStoryCard: React.FC<{ story: VideoStory; to?: string; onOpen?: () => void }> = ({ story, to, onOpen }) => {
  const body = (
    <>
      <span className="relative block overflow-hidden rounded-2xl">
        <img src={story.poster} alt="" loading="lazy" className="block aspect-video w-full object-cover" />
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-lg text-botanical-800 shadow">▶</span>
        </span>
      </span>
      <span className="mt-3 block font-display text-xl font-bold text-charcoal">{story.title}</span>
      <span className="block text-sm text-charcoal/70">{story.summary}</span>
      <span className="mt-2 block text-xs font-semibold text-botanical-800">
        Video · about {story.minutes} {story.minutes === 1 ? "minute" : "minutes"}
      </span>
    </>
  );
  const cls = "block h-full w-full rounded-3xl bg-white p-4 text-left shadow-card focus:outline-none focus:ring-2 focus:ring-botanical-700";
  return (
    <li>
      {to ? (
        <Link to={to} className={cls}>{body}</Link>
      ) : (
        <button type="button" onClick={onOpen} className={cls}>{body}</button>
      )}
    </li>
  );
};
