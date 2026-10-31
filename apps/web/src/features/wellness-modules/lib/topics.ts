// The PCOS / PCOD learning topics: what each banner says and the content of
// its interactive part. General information, not medical advice; like the
// rest of the module, the wording waits for a professional review.

export type TopicId = "myths" | "symptoms" | "wellbeing" | "sleep" | "doctor" | "tracker";

export interface Topic {
  id: TopicId;
  kicker: string;
  title: string;
  blurb: string;
}

export const TOPICS: Record<TopicId, Topic> = {
  myths: {
    id: "myths",
    kicker: "Myths and facts",
    title: "What's true, and what isn't",
    blurb: "Flip each common belief to see what the evidence says.",
  },
  symptoms: {
    id: "symptoms",
    kicker: "Understanding symptoms",
    title: "Signs that can come with it",
    blurb: "Tap a sign to learn more. Many people have only a few, and that is normal too.",
  },
  wellbeing: {
    id: "wellbeing",
    kicker: "Emotional wellbeing",
    title: "Be as kind to yourself as you are to others",
    blurb: "Gentle ways to answer a hard thought, ease stress and find support.",
  },
  sleep: {
    id: "sleep",
    kicker: "Sleep and rest",
    title: "Let the day settle",
    blurb: "Build a wind-down routine that works for you, one step at a time.",
  },
  doctor: {
    id: "doctor",
    kicker: "Doctor visits and treatment",
    title: "Walk in prepared",
    blurb: "Know what a check-up may include and keep your questions in one place.",
  },
  tracker: {
    id: "tracker",
    kicker: "My personal health tracker",
    title: "Your notes, only for you",
    blurb: "Periods, how you felt, symptoms and sleep. Add only what you want to.",
  },
};

// ------------------------------------------------------------------ symptoms

export interface Sign {
  id: string;
  label: string;
  about: string;
  help: string;
}

export const SIGNS_NOTE =
  "Not everyone has all of these, and having some of them does not mean you have PCOS or PCOD. Only a doctor can tell.";

export const SIGNS: readonly Sign[] = [
  {
    id: "periods",
    label: "Irregular or missed periods",
    about: "Periods may come far apart, close together or stop for a while, because ovulation does not happen every month.",
    help: "Writing down the dates helps your doctor see the pattern. Periods that stop for three months or more are worth a check-up.",
  },
  {
    id: "skin",
    label: "Acne",
    about: "Higher levels of some hormones can lead to breakouts, often along the jaw, chin or back.",
    help: "Gentle skin care helps, and a doctor or skin specialist can talk you through treatments if it bothers you.",
  },
  {
    id: "hair",
    label: "Extra facial or body hair",
    about: "Some people notice more hair on the face, chest or tummy. It is common and nothing to be ashamed of.",
    help: "Whether and how to treat it is your choice. A doctor can explain the medical options.",
  },
  {
    id: "thinning",
    label: "Hair thinning on the scalp",
    about: "Hair on the head may become thinner, especially around the parting.",
    help: "Mention it at your check-up; there are treatments that can slow it.",
  },
  {
    id: "sugar",
    label: "Changes in how the body uses sugar",
    about: "Insulin resistance can come with PCOS. It may show as tiredness after meals or darker, velvety skin on the neck or underarms.",
    help: "Regular check-ups with a blood sugar test help catch changes early.",
  },
  {
    id: "mood",
    label: "Mood changes, worry or low mood",
    about: "Feeling anxious or low is more common with PCOS. It is part of the condition, not a weakness.",
    help: "Talking to someone you trust, or to a doctor or counsellor, can help a lot.",
  },
  {
    id: "tired",
    label: "Tiredness and poor sleep",
    about: "Some people feel tired often or sleep badly, including snoring or waking unrested.",
    help: "If it goes on for weeks, tell your doctor; sleep problems can be looked into.",
  },
  {
    id: "fertility",
    label: "Difficulty getting pregnant",
    about: "Irregular ovulation can make it take longer, but many people with PCOS or PCOD do become pregnant.",
    help: "If and when it matters to you, a doctor can explain the support that is available.",
  },
];

// ------------------------------------------------------------------ wellbeing

export interface Reframe {
  harsh: string;
  kind: string;
}

export const REFRAMES: readonly Reframe[] = [
  { harsh: "My body is working against me.", kind: "My body is doing its best, and I'm learning how to support it." },
  { harsh: "I should be handling this better.", kind: "This is a lot to handle. I'm allowed to go at my own pace." },
  { harsh: "Everyone will notice my skin or hair.", kind: "People notice much less than I think, and I am more than how I look." },
  { harsh: "It's my fault I have this.", kind: "PCOS and PCOD are not caused by anything I did wrong." },
  { harsh: "Nothing I do makes a difference.", kind: "Small, steady habits count, even on days I can't see it." },
];

export const WELLBEING_STEPS: readonly string[] = [
  "Name what you feel, out loud or on paper. Naming a feeling makes it a little smaller.",
  "Take three slow breaths, with the out-breath longer than the in-breath.",
  "Do one small kind thing for yourself today: a warm drink, a walk or a song you like.",
  "Tell one person you trust how you're really doing.",
];

export const WELLBEING_HELP =
  "If low or anxious feelings last two weeks or more, or make everyday life hard, please talk to a doctor or counsellor. You deserve support.";

// ------------------------------------------------------------------ sleep

export const WIND_DOWN: readonly string[] = [
  "Dim the lights about an hour before bed",
  "Put screens away, or turn on night mode",
  "Have a warm, caffeine-free drink",
  "Write down tomorrow's worries so they stay on paper",
  "Do a few minutes of breathing or gentle stretching",
  "Go to bed and wake up at about the same time",
];

export const SLEEP_FACTS: readonly string[] = [
  "Sleep and hormones affect each other, so rest is part of care, not a luxury.",
  "A short nap (under 30 minutes) is fine; long naps late in the day can make nights harder.",
  "Daylight in the morning helps your body clock know when to feel sleepy.",
];

export const SLEEP_HELP =
  "If you often snore loudly, wake up gasping, or sleep badly for more than a few weeks, mention it to your doctor. Sleep problems can be checked and treated.";

// ------------------------------------------------------------------ doctor visits

export const CHECKUP_STEPS: readonly { title: string; detail: string }[] = [
  {
    title: "Talking about your history",
    detail: "Your doctor may ask about your periods, skin, hair, sleep, mood and family health. Your tracker notes can help here.",
  },
  {
    title: "A physical check",
    detail: "This may include blood pressure. You can always ask what a check is for, and ask for a female doctor or a chaperone.",
  },
  {
    title: "Blood tests",
    detail: "Tests may look at hormones, blood sugar and cholesterol. Ask when and how you'll get the results.",
  },
  {
    title: "Sometimes an ultrasound",
    detail: "A scan can show the ovaries. It is not always needed, and you can ask what kind of scan it will be.",
  },
  {
    title: "Talking through treatment",
    detail: "Options may include everyday habits, medicine for periods, skin or hair, and support if you want to become pregnant. You choose together with your doctor.",
  },
];

export const VISIT_TIP = "Bring your questions and your tracker summary. It's fine to say \"Can you explain that again?\"";

/** Every line a person reads in the topics, so tests can check the tone. */
export function allTopicTexts(): string[] {
  return [
    ...Object.values(TOPICS).flatMap((t) => [t.kicker, t.title, t.blurb]),
    SIGNS_NOTE,
    ...SIGNS.flatMap((s) => [s.label, s.about, s.help]),
    ...REFRAMES.map((r) => r.kind),
    ...WELLBEING_STEPS,
    WELLBEING_HELP,
    ...WIND_DOWN,
    ...SLEEP_FACTS,
    SLEEP_HELP,
    ...CHECKUP_STEPS.flatMap((c) => [c.title, c.detail]),
    VISIT_TIP,
  ];
}
