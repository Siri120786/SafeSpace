// Safe Harbor's words: the toolkit exercises, the learning topics (adults
// only) and the calm plan's prompts. General, non-clinical support; like the
// rest of the modules, the wording waits for a professional review.

// ------------------------------------------------------------------ toolkit

export type ToolId = "grounding" | "breathe" | "safe-place" | "container";

export const TOOLS: readonly { id: ToolId; name: string; line: string }[] = [
  { id: "grounding", name: "Ground yourself", line: "5-4-3-2-1 with your senses, right here." },
  { id: "breathe", name: "Breathe with the rain", line: "A slow, steady breath, nothing to get right." },
  { id: "safe-place", name: "A safe place", line: "Picture somewhere you feel calm and held." },
  { id: "container", name: "Put it away for now", line: "Set a heavy thought aside to come back to later." },
];

export const SAFE_PLACE_STEPS: readonly string[] = [
  "Think of a place where you feel calm and safe. It can be real, remembered or imagined.",
  "Look around it. Notice the colours, the light and what is near you.",
  "Listen. What can you hear there? It might be quiet, or soft sounds.",
  "Notice how the air feels: warm or cool, still or a gentle breeze.",
  "Notice how your body feels here. Let your shoulders drop a little.",
  "Give this place a word or a name. You can come back to it any time by thinking of that word.",
];

export const CONTAINER_STEPS: readonly string[] = [
  "Imagine a strong container: a box, a chest or a jar with a lid that closes well.",
  "Notice the thought, memory or feeling that is too heavy right now. You don't need to look at it closely.",
  "Picture placing it inside the container. Take your time.",
  "Close the lid. Lock it or tie it if that helps. It will stay there safely.",
  "Put the container somewhere far away, until you choose to open it, maybe with someone you trust.",
];

// ------------------------------------------------------------------ topics (adults)

export type TopicId = "responses" | "memories" | "sleep" | "support";

export const TOPICS: readonly { id: TopicId; kicker: string; title: string; blurb: string }[] = [
  {
    id: "responses",
    kicker: "Understanding trauma responses",
    title: "Your body was trying to protect you",
    blurb: "Fight, flight, freeze and fawn: what they are and why they happen.",
  },
  {
    id: "memories",
    kicker: "When memories come back",
    title: "That was then, this is now",
    blurb: "A few steps for the moments when the past feels close.",
  },
  {
    id: "sleep",
    kicker: "Sleep and nightmares",
    title: "Rest can come back slowly",
    blurb: "Wind-down ideas, and what can help after a bad dream.",
  },
  {
    id: "support",
    kicker: "Finding support",
    title: "You don't have to carry it alone",
    blurb: "Talking to someone you trust, and what professional help can look like.",
  },
];

export const RESPONSES: readonly { id: string; name: string; what: string; feels: string; helps: string }[] = [
  {
    id: "fight",
    name: "Fight",
    what: "The body gets ready to push back against danger.",
    feels: "Anger, tight muscles, a racing heart, wanting to shout or lash out.",
    helps: "Moving your body safely, slow breaths out, putting space between you and what set it off.",
  },
  {
    id: "flight",
    name: "Flight",
    what: "The body gets ready to get away from danger.",
    feels: "Restlessness, worry, wanting to leave, feeling on edge or keeping very busy.",
    helps: "Grounding with your senses, a calm walk, reminding yourself where you are now.",
  },
  {
    id: "freeze",
    name: "Freeze",
    what: "The body goes still when fighting or running doesn't feel possible.",
    feels: "Numbness, feeling stuck or far away, finding it hard to move or speak.",
    helps: "Small movements (wiggle fingers and toes), naming things you can see, a warm drink.",
  },
  {
    id: "fawn",
    name: "Fawn",
    what: "The body tries to stay safe by keeping others happy.",
    feels: "Saying yes when you mean no, putting others first, finding it hard to set limits.",
    helps: "Noticing what you need, practising small no's, support from people who respect you.",
  },
];

export const RESPONSES_NOTE =
  "These are automatic survival responses, not choices or weaknesses. Noticing them is a first step to feeling more in control.";

export const MEMORY_STEPS: readonly { title: string; detail: string }[] = [
  { title: "Notice it", detail: "Say to yourself: \"This is a memory. It is not happening now.\"" },
  { title: "Feel your feet", detail: "Press your feet into the floor. Feel what is holding you up." },
  { title: "Look around", detail: "Name five things you can see, and today's date and place." },
  { title: "Breathe out slowly", detail: "Let each breath out be a little longer than the breath in." },
  { title: "Hold something", detail: "A cool glass of water, a soft fabric, or something that smells comforting." },
  { title: "Reach out", detail: "If it stays strong, text or call someone from your calm plan." },
];

export const WIND_DOWN: readonly string[] = [
  "Keep a small light on if the dark feels unsafe",
  "Put screens away a little before bed",
  "Write down anything on your mind, then close the notebook",
  "Do a slow breathing or safe-place exercise in bed",
  "Keep something comforting nearby: a blanket, a soft toy, a familiar smell",
];

export const AFTER_NIGHTMARE: readonly string[] = [
  "Turn on a light and remind yourself where you are and that you're safe.",
  "Sit up, put your feet on the floor and breathe out slowly.",
  "Have a sip of water and notice its coolness.",
  "If it helps, write the dream down with a different, safer ending.",
];

export const SLEEP_HELP =
  "If nightmares or poor sleep go on for weeks, tell a doctor. Sleep problems after trauma are common and can be treated.";

export const SUPPORT_OPTIONS: readonly { id: string; name: string; detail: string }[] = [
  { id: "trusted", name: "Someone I trust", detail: "A friend, family member or anyone who listens without judging. You can share as much or as little as you like." },
  { id: "doctor", name: "A doctor", detail: "A family doctor can listen, check how you're sleeping and coping, and point you to the right help." },
  {
    id: "therapy",
    name: "A therapist or counsellor",
    detail: "Talking therapies made for trauma, such as trauma-focused CBT or EMDR, are recommended by health guidelines and help many people. A doctor can explain the options.",
  },
  { id: "group", name: "A support group", detail: "Meeting others who understand can help you feel less alone." },
];

export const SUPPORT_HELP =
  "If you ever feel unsafe or think about harming yourself, contact your local emergency number or a crisis helpline now. You deserve help right away.";

// ------------------------------------------------------------------ calm plan

export const CALM_PLAN_SECTIONS: readonly {
  id: "signs" | "helps" | "people" | "places";
  title: string;
  prompt: string;
  ideas: readonly string[];
}[] = [
  {
    id: "signs",
    title: "Signs I need a pause",
    prompt: "What do you notice when things start to feel too much?",
    ideas: ["My heart races", "I feel far away", "I can't sit still", "I snap at people"],
  },
  {
    id: "helps",
    title: "What helps me feel safe",
    prompt: "Things you can do that settle you, even a little.",
    ideas: ["Slow breathing", "A warm drink", "My favourite music", "Holding something soft"],
  },
  {
    id: "people",
    title: "People I can reach out to",
    prompt: "Who could you message or call? Just a name is enough.",
    ideas: ["A friend", "A family member", "My doctor", "A helpline"],
  },
  {
    id: "places",
    title: "Places that feel calm",
    prompt: "Real or imagined places where you feel at ease.",
    ideas: ["My room", "A park", "By the water", "My safe place"],
  },
];

/** Every line a person reads here, so tests can check the tone. */
export function allHarborTexts(): string[] {
  return [
    ...TOOLS.flatMap((t) => [t.name, t.line]),
    ...SAFE_PLACE_STEPS,
    ...CONTAINER_STEPS,
    ...TOPICS.flatMap((t) => [t.kicker, t.title, t.blurb]),
    ...RESPONSES.flatMap((r) => [r.name, r.what, r.feels, r.helps]),
    RESPONSES_NOTE,
    ...MEMORY_STEPS.flatMap((m) => [m.title, m.detail]),
    ...WIND_DOWN,
    ...AFTER_NIGHTMARE,
    SLEEP_HELP,
    ...SUPPORT_OPTIONS.flatMap((s) => [s.name, s.detail]),
    SUPPORT_HELP,
    ...CALM_PLAN_SECTIONS.flatMap((c) => [c.title, c.prompt, ...c.ideas]),
  ];
}
