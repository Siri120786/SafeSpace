/**
 * PCOS / PCOD hub: which condition the person follows, and the wording that differs between them.
 * Pure content and helpers, no React.
 *
 * Honest framing (see docs/pcos-pcod-research-notes.md): international guidelines and the Rotterdam
 * criteria define PCOS only. "PCOD" is a popular label, common in India, that clinics often describe
 * as the milder, more lifestyle-responsive picture, while many doctors treat the two as the same.
 * So the app never diagnoses or decides which one a person has. The person picks the label their
 * doctor uses, and only the emphasis of the tips changes. Everything is unreviewed wording
 * (docs/content-needing-review.md) and needs clinician review before real users.
 */

export type Condition = "pcos" | "pcod" | "unsure";
export const CONDITIONS: readonly { id: Condition; label: string }[] = [
  { id: "pcos", label: "PCOS" },
  { id: "pcod", label: "PCOD" },
  { id: "unsure", label: "Not sure yet" },
];

export function conditionLabel(c: Condition | null): string {
  return CONDITIONS.find((x) => x.id === c)?.label ?? "PCOS / PCOD";
}

export function sanitizeCondition(raw: unknown): Condition | null {
  return CONDITIONS.some((c) => c.id === raw) ? (raw as Condition) : null;
}

export const TERMS_NOTE =
  "Doctors often use PCOS as the main medical term, and PCOD is a popular label. Some doctors use them to mean the same thing, and some use PCOD for a milder picture. Please ask your doctor which one applies to you. This app does not decide that.";

export interface AboutBlock {
  title: string;
  points: readonly string[];
}

export const ABOUT: Record<"pcos" | "pcod", AboutBlock> = {
  pcos: {
    title: "About PCOS (polycystic ovary syndrome)",
    points: [
      "PCOS is a hormonal (endocrine) condition. It is called a syndrome because it can show up in several ways.",
      "Doctors usually look for two of these three: irregular or missed ovulation and periods, signs of higher male-type hormones (such as acne, extra hair growth or hair thinning), and ovaries that look polycystic on a scan.",
      "It can also come with insulin resistance, which affects how the body uses sugar, so regular check-ups matter over the years.",
      "Care is usually a mix of everyday habits and, for some people, medicine chosen by their doctor.",
    ],
  },
  pcod: {
    title: "About PCOD (polycystic ovarian disease)",
    points: [
      "PCOD is a popular label for when the ovaries release many immature eggs that can look like small cysts on a scan, often with irregular periods.",
      "It is often described as a milder, very common picture that responds well to everyday habits like regular meals, movement, sleep and calming stress.",
      "Some people still need medical care, for example for painful or very irregular periods, so it is worth talking to a doctor.",
      "Many people with PCOD have regular check-ups and manage well. It is not caused by anything you did.",
    ],
  },
};

export const DIFFERENCES: readonly { aspect: string; pcos: string; pcod: string }[] = [
  { aspect: "In everyday use", pcos: "The standard medical term for a hormonal syndrome.", pcod: "A popular label, often for a milder, ovary-focused picture." },
  { aspect: "Periods", pcos: "Often irregular or infrequent.", pcod: "Often irregular." },
  { aspect: "Other signs", pcos: "Can include acne, extra hair growth, hair thinning and insulin resistance.", pcod: "Other signs are often milder or fewer." },
  { aspect: "Long-term check-ups", pcos: "Doctors often suggest regular checks of blood sugar, cholesterol and blood pressure.", pcod: "Doctors often focus on period regularity and lifestyle, and add checks if needed." },
  { aspect: "Everyday care", pcos: "Habits matter, and some people also need medicine.", pcod: "Habits matter most, and many people manage with lifestyle support." },
];

export const DIFFERENCES_NOTE = "This is a general picture. Real life varies a lot, and the two overlap. Only your doctor can tell you what applies to you.";

/** Things the person may want to ask about, by condition. Questions, never instructions. */
export const CHECKUP_QUESTIONS: Record<"pcos" | "pcod", readonly string[]> = {
  pcos: [
    "Should I have my blood sugar, cholesterol and blood pressure checked, and how often?",
    "Could insulin resistance be part of my picture?",
    "Do I need hormone blood tests or a scan?",
    "What are my options for irregular periods, acne or hair changes?",
    "If I plan a pregnancy one day, what should I know?",
  ],
  pcod: [
    "How can I tell if my periods are becoming more regular?",
    "Do I need any tests, or is a lifestyle plan enough for now?",
    "How often should I check back with you?",
    "What should I do about painful or very heavy periods?",
    "If I plan a pregnancy one day, what should I know?",
  ],
};

export const SHARED_QUESTIONS: readonly string[] = [
  "What support is there for my mood, stress or sleep?",
  "Is it okay to take my supplements together with my medicine?",
];

export function visitQuestionsFor(c: Condition | null): string[] {
  if (c === "pcos") return [...CHECKUP_QUESTIONS.pcos, ...SHARED_QUESTIONS];
  if (c === "pcod") return [...CHECKUP_QUESTIONS.pcod, ...SHARED_QUESTIONS];
  return [CHECKUP_QUESTIONS.pcos[0], CHECKUP_QUESTIONS.pcod[0], "Which one applies to me, PCOS or PCOD?", ...SHARED_QUESTIONS];
}

/** Extra eating tips on top of the general ones, by condition. */
export const FOOD_FOCUS: Record<"pcos" | "pcod", readonly string[]> = {
  pcos: [
    "Because insulin can play a part, steady meals with fibre and protein help many people avoid big sugar swings.",
    "Choosing slower-digesting carbohydrates, like millets, oats and pulses, is a common suggestion.",
  ],
  pcod: [
    "Regular, balanced meals and enough fibre are a good base. Try not to skip meals.",
    "Cutting back gently on refined sugar and fried packaged snacks is a common suggestion.",
  ],
};

export const FOOD_SHARED_NOTE = "Crash diets and skipping meals are not recommended for either. Slow and steady habits work better.";

export function foodFocusFor(c: Condition | null): string[] {
  if (c === "pcos") return [...FOOD_FOCUS.pcos];
  if (c === "pcod") return [...FOOD_FOCUS.pcod];
  return [...FOOD_FOCUS.pcos, ...FOOD_FOCUS.pcod];
}

/** Movement emphasis by condition. General information, not a prescription. */
export const MOVE_FOCUS: Record<"pcos" | "pcod", readonly string[]> = {
  pcos: [
    "A common general guideline for adults is about 150 minutes of moderate activity a week, plus two days of muscle-strengthening. You can start with much less.",
    "Many people find a mix of walking, some strength work and calming movement useful. No single type is proven best.",
  ],
  pcod: [
    "A common general guideline for adults is about 150 minutes of moderate activity a week. You can start with much less.",
    "Regular walking, light strength work and yoga are popular choices. Gentle, regular movement matters more than hard sessions.",
  ],
};

export const MOVE_SHARED_NOTE =
  "More is not always better. Rest days are part of a healthy week. Stop and check with a doctor if you feel pain, dizziness or unwell.";

export const YOGA_NOTE = "Yoga can help many people feel calmer and move gently. Research on yoga for PCOS is still small, so think of it as one helpful habit, not a treatment.";

export function moveFocusFor(c: Condition | null): string[] {
  if (c === "pcos") return [...MOVE_FOCUS.pcos];
  if (c === "pcod") return [...MOVE_FOCUS.pcod];
  return [...MOVE_FOCUS.pcos];
}

// ---------------------------------------------------------------- myths and facts

export interface Myth {
  myth: string;
  fact: string;
  /** Which label this belongs to. "both" is shown to everyone. */
  appliesTo: "pcos" | "pcod" | "both";
}

/** General education only. Unreviewed: needs clinician review before release. */
export const MYTHS: readonly Myth[] = [
  { appliesTo: "both", myth: "PCOS or PCOD means you have cysts on your ovaries that must be removed.", fact: "The name can be misleading. The small follicles seen on scans are not usually harmful cysts, and surgery is not the usual treatment. A doctor can explain what is right for you." },
  { appliesTo: "both", myth: "Only people who are overweight get PCOS or PCOD.", fact: "It can affect people of many body sizes, including people who are slim." },
  { appliesTo: "pcos", myth: "Everyone with PCOS has the same symptoms.", fact: "Symptoms differ a lot from person to person. Some people have irregular periods, some do not." },
  { appliesTo: "both", myth: "PCOS or PCOD means you can never have a baby.", fact: "Ovulation can be irregular, and some people need medical support, but many people with PCOS or PCOD do become pregnant." },
  { appliesTo: "both", myth: "Birth control pills cure it.", fact: "There is no cure. Treatments help manage symptoms, and the right choice is something to talk through with a doctor." },
  { appliesTo: "both", myth: "It is your fault.", fact: "The exact cause is not fully known. Genes and hormones play a part. It is not caused by anything you did wrong." },
  { appliesTo: "pcod", myth: "PCOD is a serious disease that cannot be managed.", fact: "Many people manage PCOD well with regular habits and check-ups. A doctor can guide you." },
  { appliesTo: "pcod", myth: "Skipping meals or crash dieting will fix PCOD.", fact: "Crash diets can upset your body and mood. Regular, balanced meals and steady habits are gentler and work better." },
  { appliesTo: "pcod", myth: "Irregular periods are normal, so there is no need to see a doctor.", fact: "Irregular periods are common with PCOD, but it is still worth checking with a doctor, especially if periods are very painful, very heavy or missing." },
  { appliesTo: "pcos", myth: "PCOS only affects periods and fertility.", fact: "PCOS can also affect skin, hair, mood, sleep and how the body uses sugar, which is why regular check-ups help." },
  { appliesTo: "pcos", myth: "If your periods become regular, PCOS is gone.", fact: "PCOS is long-term. Symptoms can improve, but it still needs a check-up from time to time." },
  { appliesTo: "both", myth: "PCOS and PCOD are two totally different diseases, or exactly the same thing.", fact: "The terms overlap, and doctors use them differently. Ask your own doctor what they mean for you." },
];

export function mythsFor(c: Condition | null): Myth[] {
  if (c === "pcos") return MYTHS.filter((m) => m.appliesTo !== "pcod");
  if (c === "pcod") return MYTHS.filter((m) => m.appliesTo !== "pcos");
  return [...MYTHS];
}

export const MYTHS_NOTE = "This is general information, not medical advice. Please talk to a doctor about your own health.";

/** Every line in this file that a person reads, so tests can check the tone. */
export function allConditionTexts(): string[] {
  return [
    TERMS_NOTE,
    ...Object.values(ABOUT).flatMap((a) => [a.title, ...a.points]),
    ...DIFFERENCES.flatMap((d) => [d.aspect, d.pcos, d.pcod]),
    DIFFERENCES_NOTE,
    ...Object.values(CHECKUP_QUESTIONS).flat(),
    ...SHARED_QUESTIONS,
    ...Object.values(FOOD_FOCUS).flat(),
    FOOD_SHARED_NOTE,
    ...Object.values(MOVE_FOCUS).flat(),
    MOVE_SHARED_NOTE,
    YOGA_NOTE,
    ...MYTHS.flatMap((m) => [m.myth, m.fact]),
    MYTHS_NOTE,
  ];
}
