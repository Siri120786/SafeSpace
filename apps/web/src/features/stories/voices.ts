// Each character's voice in the story player. The device decides which voices
// exist, so a profile asks for a kind of voice ("the second female voice"),
// plus pitch and speed. With several voices the grown-ups sound like
// different people; with only one, pitch and speed still tell them apart.
// Every character has their own pitch and pace, so they sound different even
// on a device with one voice.
// No React here, so apps/web/tests/stories.test.mts can check them.

import type { VoiceProfile } from "../speech/speech";
import type { StoryCharacterId } from "./storyScript";

export const CHARACTER_VOICES: Record<StoryCharacterId | "narrator", VoiceProfile> = {
  // Women, lowest to highest pitch, each at their own pace.
  maya: { gender: "female", pick: 2, pitch: 0.9, rate: 0.92 },      // calm and steady
  narrator: { gender: "female", pick: 0, pitch: 1.02, rate: 0.88 }, // the warm reading voice
  asha: { gender: "female", pick: 3, pitch: 1.14, rate: 0.98 },     // bright teacher
  amma: { gender: "female", pick: 1, pitch: 1.26, rate: 0.9 },      // warm and soft
  // Children and Pip: higher and sweeter.
  kai: { gender: "female", pick: 1, pitch: 1.45, rate: 0.95 },      // sweet, a little high
  pip: { gender: "female", pick: 0, pitch: 1.95, rate: 1.12 },      // cute, small and quick
  papa: { gender: "male", pick: 0, pitch: 0.92, rate: 0.88 },
};
