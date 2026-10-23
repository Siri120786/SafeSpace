/**
 * Placeholder module content. ALL of this is unreviewed and must not be treated
 * as clinical guidance (see docs/content-needing-review.md).
 */

export const REVIEW_NOTICE = "Draft wording that is still waiting for a professional review.";

export const SUPPORT_TEXT =
  "If things feel too much, please talk to a trusted adult or your local support services. This app cannot call anyone for you.";

export const ANXIETY_TIPS: readonly string[] = [
  "Put both feet on the floor and notice how the ground feels.",
  "Name one thing in the room that feels calm to you.",
  "Let your shoulders drop as you breathe out.",
];

export const GOAL_IDEAS: readonly string[] = [
  "Drink a glass of water",
  "Step outside for a few minutes",
  "Send a short message to someone I like",
  "Tidy one small spot",
];

export const HOBBY_IDEAS: readonly string[] = [
  "Listen to a favorite song",
  "Draw or doodle for five minutes",
  "Water a plant or look at one",
  "Read a few pages of something light",
];

export const GRATITUDE_PROMPT = "What is one small thing that was okay or good today?";

export const ENCOURAGEMENTS: readonly string[] = [
  "That counts. Well done for doing it.",
  "A small step is still a step.",
  "Thank you for looking after yourself today.",
];

export const RELAXATION_STEPS: readonly string[] = [
  "Sit or lie in a way that feels safe and comfortable. You can open your eyes at any time.",
  "Notice the parts of your body that touch the chair or bed.",
  "Slowly relax your hands. Let your fingers soften.",
  "Slowly relax your shoulders and jaw.",
  "Take one slow breath in and a longer breath out. You can stop whenever you like.",
];

export const CARE_BRIDGING_TEXT =
  "Support from a real person can help a lot. Consider telling a trusted person or a health professional how you have been feeling. You do not have to do this alone.";

export const PCOS_CHECKLIST: readonly { id: string; label: string }[] = [
  { id: "water", label: "Drink water through the day" },
  { id: "medication", label: "Take my medication as my doctor told me (if I have any)" },
  { id: "movement", label: "Do some gentle movement" },
  { id: "sleep", label: "Wind down for sleep" },
];

export const MOVEMENT_IDEAS: readonly string[] = [
  "A short, easy walk",
  "Gentle stretching for a few minutes",
  "Dancing to one song at your own pace",
];

export const SLEEP_STRESS_IDEAS: readonly string[] = [
  "Dim the lights and put screens away a little earlier",
  "Try the breathing exercise before bed",
  "Write down tomorrow's worries so they stay on paper",
];

export interface MythFact {
  myth: string;
  fact: string;
}

/** General education only. Unreviewed: needs clinician review before release. */
export const PCOS_MYTHS: readonly MythFact[] = [
  {
    myth: "PCOS means you have cysts on your ovaries that must be removed.",
    fact: "The name can be misleading. The small follicles seen on scans are not usually harmful cysts, and surgery is not the usual treatment. A doctor can explain what is right for you.",
  },
  {
    myth: "Only people who are overweight get PCOS.",
    fact: "PCOS can affect people of many body sizes, including people who are slim.",
  },
  {
    myth: "Everyone with PCOS has the same symptoms.",
    fact: "Symptoms differ a lot from person to person. Some people have irregular periods, some do not.",
  },
  {
    myth: "PCOS means you can never have a baby.",
    fact: "PCOS can make ovulation irregular, and some people need medical support, but many people with PCOS do become pregnant.",
  },
  {
    myth: "Birth control pills cure PCOS.",
    fact: "There is no cure. Treatments help manage symptoms, and the right choice is something to talk through with a doctor.",
  },
  {
    myth: "PCOS is your fault.",
    fact: "The exact cause is not fully known. Genes and hormones play a part. It is not caused by anything you did wrong.",
  },
];

export const MYTHS_NOTE = "This is general information, not medical advice. Please talk to a doctor about your own health.";

/** Adult-only module: only adult 'user' accounts may open Cycle Care (pending adult-access decision). */
export function canOpenCycleCare(role: string | null | undefined): boolean {
  return role === "user";
}

export interface ModuleInfo {
  key: "anxiety" | "depression" | "ptsd" | "pcos_pcod";
  name: string;
  path: string;
  blurb: string;
}

export const MODULES: readonly ModuleInfo[] = [
  { key: "anxiety", name: "Calm Space", path: "/modules/calm-space", blurb: "Breathing, grounding and calming tips." },
  { key: "depression", name: "Bright Days", path: "/modules/bright-days", blurb: "Small goals and gratitude notes." },
  { key: "ptsd", name: "Safe Harbor", path: "/modules/safe-harbor", blurb: "A quiet space with text relaxation steps." },
  { key: "pcos_pcod", name: "Cycle Care", path: "/modules/cycle-care", blurb: "Daily self-care checklist (adults only)." },
];
