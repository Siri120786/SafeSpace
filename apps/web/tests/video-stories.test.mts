/**
 * Built-in video stories (features/stories/videoLibrary.ts). Run with:
 * tsx apps/web/tests/video-stories.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { VIDEO_STORIES, findVideoStory } from "../src/features/stories/videoLibrary.ts";
import { DENTIST_STORY } from "../src/features/stories/library/dentist.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

test("three video stories: sharing, feelings and the dentist", () => {
  assert.deepEqual(VIDEO_STORIES.map((s) => s.id), [
    "video-kai-and-jaya-sharing",
    "video-kai-learns-emotions",
    "video-visit-to-the-dentist",
  ]);
});

test("ids are unique and never clash with a drawn story", () => {
  const ids = VIDEO_STORIES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith("video-")));
  assert.ok(!ids.includes(DENTIST_STORY.id));
});

test("every video and poster file is in the app", () => {
  for (const s of VIDEO_STORIES) {
    for (const url of [s.video, s.poster]) assert.ok(existsSync(fileURLToPath(url)), `missing ${url}`);
  }
});

test("videos are sized for streaming (under 25 MB) and posters are small", () => {
  for (const s of VIDEO_STORIES) {
    assert.ok(statSync(fileURLToPath(s.video)).size < 25 * 1024 * 1024, `${s.id} video too large`);
    assert.ok(statSync(fileURLToPath(s.poster)).size < 200 * 1024, `${s.id} poster too large`);
  }
});

test("each story has a title, a short summary and a running time", () => {
  for (const s of VIDEO_STORIES) {
    assert.ok(s.title.length > 0 && s.summary.length > 0 && s.summary.length <= 120);
    assert.ok(Number.isInteger(s.minutes) && s.minutes >= 1 && s.minutes <= 10);
  }
});

test("lookup finds a video story by id, and nothing for other ids", () => {
  assert.equal(findVideoStory("video-visit-to-the-dentist")?.title, "A visit to the dentist");
  assert.equal(findVideoStory("kai-visits-the-dentist"), null);
  assert.equal(findVideoStory(""), null);
});

console.log(`${passed} video-story checks`);
