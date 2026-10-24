// Manju's feelings cards (Workstream B). The ids are the database's list of
// allowed cards (emotion_choices.card_id, migration 20261028200000).
import type { EmotionCardItem } from "./types";

// Content needing review: non-clinical supportive prompt
export const DEFAULT_EMOTION_CARDS: EmotionCardItem[] = [
  {
    id: "happy",
    label: "Happy",
    emoji: "😊",
    sharedMoodValue: "happy",
    // Content needing review: non-clinical supportive prompt
    reassurance: "It feels wonderful to have a smiling heart today.",
  },
  {
    id: "calm",
    label: "Calm",
    emoji: "🌿",
    // Content needing review: non-clinical supportive prompt
    reassurance: "Your body is peaceful and resting like a gentle leaf.",
  },
  {
    id: "ecstatic",
    label: "Very Joyful",
    emoji: "✨",
    sharedMoodValue: "ecstatic",
    // Content needing review: non-clinical supportive prompt
    reassurance: "So much sparkle and energy inside you today!",
  },
  {
    id: "neutral",
    label: "In-Between",
    emoji: "☁️",
    sharedMoodValue: "neutral",
    // Content needing review: non-clinical supportive prompt
    reassurance: "It is completely okay to simply feel okay or in-between.",
  },
  {
    id: "sad",
    label: "Sad",
    emoji: "🌧️",
    sharedMoodValue: "sad",
    // Content needing review: non-clinical supportive prompt
    reassurance: "It's okay to feel sad. You don't have to rush your feelings.",
  },
  {
    id: "tired",
    label: "Tired",
    emoji: "🌙",
    // Content needing review: non-clinical supportive prompt
    reassurance: "Rest is gentle and productive. Take all the quiet time you need.",
  },
  {
    id: "stressed",
    label: "A Bit Full",
    emoji: "🫧",
    sharedMoodValue: "stressed",
    // Content needing review: non-clinical supportive prompt
    reassurance: "Things feel full right now. One slow, easy breath at a time.",
  },
  {
    id: "overwhelmed",
    label: "Too Much Noise",
    emoji: "🎧",
    sharedMoodValue: "overwhelmed",
    // Content needing review: non-clinical supportive prompt
    reassurance: "When things feel too big, it is okay to pause and soften the room.",
  },
  {
    id: "proud",
    label: "Proud",
    emoji: "⭐",
    // Content needing review: non-clinical supportive prompt
    reassurance: "You tried your best or did something kind, and that matters.",
  },
  {
    id: "curious",
    label: "Curious",
    emoji: "🔍",
    // Content needing review: non-clinical supportive prompt
    reassurance: "Your wondering mind is ready to explore gently.",
  },
];
