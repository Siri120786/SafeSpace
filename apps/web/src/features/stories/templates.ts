// Ready-made social stories a caregiver starts from (role-flow 6b), then edits
// in the story editor. No AI and no network: a template is a full script.
// Every template has a coping step and ends calm and proud. Telugu lines are a
// first draft for a native speaker to check (docs/content-needing-review.md);
// the editor marks them "draft" until the caregiver confirms them.
// No React here, so apps/web/tests/stories.test.mts can check them.

import { DENTIST_STORY } from "./library/dentist";
import type { Story, StoryCastMember, StoryLine, StoryScene } from "./storyScript";

export interface StoryTemplate {
  key: string; // stored as template_key
  emoji: string;
  title: { en: string; te: string };
  blurb: string;
  script: Story;
}

type Extra = Pick<StoryScene, "camera" | "effect">;
const L = (speaker: StoryLine["speaker"], en: string, te: string): StoryLine => ({ speaker, en, te });
const scene = (id: string, background: StoryScene["background"], cast: StoryCastMember[], lines: StoryLine[], extra: Extra = {}): StoryScene =>
  ({ id, background, cast, lines, ...extra });

const BREATHE_EN = "Breathe in slowly... and breathe out.";
const BREATHE_TE = "నెమ్మదిగా శ్వాస లోపలికి తీసుకో... బయటికి వదులు.";

const NEW_SCHOOL: Story = {
  id: "new-school",
  title: { en: "Kai's first day at a new school", te: "కొత్త స్కూల్‌లో కై మొదటి రోజు" },
  summary: { en: "Meeting the teacher, the bell, and asking for a quiet moment.", te: "టీచర్‌ని కలవడం, బెల్, నిశ్శబ్ద సమయం అడగడం." },
  scenes: [
    scene("morning", "home", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center" },
      { id: "papa", slot: "right", expression: "happy" },
    ], [
      L("amma", "Kai, today is your first day at your new school.", "కై, ఈరోజు నీ కొత్త స్కూల్‌లో మొదటి రోజు."),
      L("papa", "You will meet your teacher and new friends.", "నువ్వు నీ టీచర్‌ని, కొత్త స్నేహితులను కలుస్తావు."),
    ]),
    scene("worry", "home", [
      { id: "amma", slot: "left", action: "nod" },
      { id: "kai", slot: "center", expression: "worried" },
      { id: "pip", slot: "right" },
    ], [
      L("kai", "I feel nervous. Everything will be new.", "నాకు కొంచెం భయంగా ఉంది. అన్నీ కొత్తగా ఉంటాయి."),
      L("amma", "Feeling nervous is okay. New things get easier each day.", "భయపడటం పర్వాలేదు. కొత్త విషయాలు రోజూ కొంచెం సులభం అవుతాయి."),
    ], { camera: { shot: "medium", focus: "kai" } }),
    scene("breathe", "home", [
      { id: "kai", slot: "midleft", action: "breathe" },
      { id: "pip", slot: "midright", expression: "happy", action: "hop" },
    ], [
      L("pip", "Let's take three slow breaths together.", "మనం కలిసి మూడు సార్లు నెమ్మదిగా శ్వాస తీసుకుందాం."),
      L("narrator", BREATHE_EN, BREATHE_TE),
    ], { effect: "breathing" }),
    scene("leaving", "front_door", [
      { id: "kai", slot: "midleft", action: "walk_out", holding: "backpack" },
      { id: "papa", slot: "midright", expression: "happy", action: "walk_out" },
    ], [
      L("narrator", "Kai puts on his backpack. Papa walks with him to school.", "కై తన బ్యాగ్ వేసుకున్నాడు. నాన్న అతనితో కలిసి స్కూల్‌కి నడుస్తాడు."),
    ]),
    scene("meet-teacher", "classroom", [
      { id: "kai", slot: "midleft", expression: "surprised", holding: "backpack" },
      { id: "asha", slot: "right", expression: "happy", action: "walk_in" },
    ], [
      L("asha", "Hello Kai! I'm Ms. Asha, your teacher. Welcome!", "హలో కై! నేను ఆశా, నీ టీచర్‌ని. స్వాగతం!"),
      L("kai", "Hello, Ms. Asha.", "హలో, ఆశా టీచర్."),
    ]),
    scene("the-seat", "classroom", [
      { id: "kai", slot: "midleft", pose: "sit" },
      { id: "asha", slot: "right", expression: "happy", action: "point" },
    ], [
      L("asha", "This is your chair. You can sit here every day.", "ఇది నీ కుర్చీ. నువ్వు రోజూ ఇక్కడ కూర్చోవచ్చు."),
      L("narrator", "The classroom has a board, books and a clock.", "క్లాస్‌రూమ్‌లో బోర్డు, పుస్తకాలు, గడియారం ఉన్నాయి."),
    ]),
    scene("the-bell", "classroom", [
      { id: "kai", slot: "midleft", expression: "worried", pose: "sit" },
      { id: "asha", slot: "right" },
    ], [
      L("narrator", "Sometimes a bell rings. It can be loud.", "కొన్నిసార్లు బెల్ మోగుతుంది. అది గట్టిగా ఉండొచ్చు."),
      L("asha", "The bell means it's time for a break. You can cover your ears if it's too loud.", "బెల్ అంటే విరామ సమయం అని అర్థం. శబ్దం ఎక్కువగా అనిపిస్తే నువ్వు చెవులు మూసుకోవచ్చు."),
    ], { effect: "bell" }),
    scene("quiet-moment", "classroom", [
      { id: "kai", slot: "midleft", pose: "sit", action: "raise_hand" },
      { id: "asha", slot: "right", action: "nod" },
    ], [
      L("kai", "Ms. Asha, I need a quiet moment.", "ఆశా టీచర్, నాకు కొంచెం నిశ్శబ్దంగా ఉండాలి."),
      L("asha", "Thank you for telling me. You can rest in the quiet corner.", "చెప్పినందుకు థ్యాంక్యూ. నువ్వు నిశ్శబ్దమైన మూలలో కాసేపు విశ్రాంతి తీసుకోవచ్చు."),
    ], { camera: { shot: "close", focus: "kai" } }),
    scene("break-time", "playground", [
      { id: "asha", slot: "left", expression: "happy" },
      { id: "kai", slot: "center", expression: "happy", action: "hop" },
    ], [
      L("narrator", "At break, Kai plays on the playground.", "విరామంలో కై ప్లేగ్రౌండ్‌లో ఆడుకుంటాడు."),
      L("kai", "The slide is fun!", "జారుడుబల్ల సరదాగా ఉంది!"),
    ]),
    scene("home-proud", "home", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center", expression: "happy", action: "hop" },
      { id: "papa", slot: "right", expression: "happy" },
    ], [
      L("amma", "How was your first day, Kai?", "నీ మొదటి రోజు ఎలా గడిచింది, కై?"),
      L("kai", "It was new, and I did it! I asked for a quiet moment when I needed one.", "అంతా కొత్తగా ఉంది, కానీ నేను చేశాను! అవసరమైనప్పుడు నిశ్శబ్ద సమయం అడిగాను."),
      L("papa", "We are so proud of you.", "నిన్ను చూసి మాకు చాలా గర్వంగా ఉంది."),
    ], { effect: "sparkles" }),
  ],
};

const DOCTOR_VISIT: Story = {
  id: "doctor-visit",
  title: { en: "Kai visits the doctor", te: "కై డాక్టర్ దగ్గరికి వెళ్తాడు" },
  summary: { en: "A check-up step by step, and how to ask for a break.", te: "చెకప్ ఒక్కో అడుగుగా, విరామం ఎలా అడగాలి." },
  scenes: [
    scene("news", "home", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center" },
    ], [
      L("amma", "Kai, today we are going to see the doctor for a check-up.", "కై, ఈరోజు మనం చెకప్ కోసం డాక్టర్ దగ్గరికి వెళ్తున్నాం."),
      L("amma", "A check-up helps us know your body is healthy and strong.", "నీ శరీరం ఆరోగ్యంగా, బలంగా ఉందని తెలుసుకోవడానికి చెకప్ సహాయపడుతుంది."),
    ]),
    scene("worry", "home", [
      { id: "amma", slot: "left", action: "nod" },
      { id: "kai", slot: "center", expression: "worried" },
      { id: "pip", slot: "right" },
    ], [
      L("kai", "Will it hurt?", "నొప్పిగా ఉంటుందా?"),
      L("amma", "Most of a check-up doesn't hurt. The doctor will tell you each step first.", "చెకప్‌లో చాలా వరకు నొప్పి ఉండదు. డాక్టర్ ప్రతి అడుగు ముందే చెబుతారు."),
    ], { camera: { shot: "medium", focus: "kai" } }),
    scene("arrive", "clinic_outside", [
      { id: "amma", slot: "left", action: "walk_in" },
      { id: "kai", slot: "midleft", action: "walk_in", holding: "teddy" },
    ], [
      L("narrator", "Kai and Amma arrive at the clinic. Kai brings his teddy.", "కై, అమ్మ క్లినిక్‌కి చేరుకున్నారు. కై తన టెడ్డీని తెచ్చుకున్నాడు."),
    ]),
    scene("waiting", "waiting_room", [
      { id: "amma", slot: "left", pose: "sit" },
      { id: "kai", slot: "midleft", pose: "sit", holding: "teddy" },
    ], [
      L("narrator", "They sit in the waiting room until it's Kai's turn.", "కై వంతు వచ్చే వరకు వాళ్ళు వెయిటింగ్ రూమ్‌లో కూర్చుంటారు."),
      L("amma", "Waiting can feel long. We can look at a book together.", "ఎదురుచూడటం చాలా సేపు అనిపించొచ్చు. మనం కలిసి ఒక పుస్తకం చూడొచ్చు."),
    ]),
    scene("meet", "doctor_room", [
      { id: "amma", slot: "left" },
      { id: "kai", slot: "center", pose: "sit" },
      { id: "maya", slot: "right", expression: "happy", action: "walk_in" },
    ], [
      L("maya", "Hello Kai! I'm Dr. Maya. You can sit on this bed.", "హలో కై! నేను డాక్టర్ మాయ. నువ్వు ఈ బెడ్ మీద కూర్చోవచ్చు."),
      L("kai", "Hello, Dr. Maya.", "హలో, డాక్టర్ మాయ."),
    ]),
    scene("stethoscope", "doctor_room", [
      { id: "amma", slot: "left" },
      { id: "kai", slot: "center", expression: "surprised", pose: "sit" },
      { id: "maya", slot: "right", holding: "stethoscope" },
    ], [
      L("maya", "This is a stethoscope. It lets me listen to your heart.", "ఇది స్టెతస్కోప్. దీనితో నేను నీ గుండె చప్పుడు వింటాను."),
      L("maya", "It might feel a little cold. That's okay.", "అది కొంచెం చల్లగా అనిపించొచ్చు. పర్వాలేదు."),
    ]),
    scene("ears", "doctor_room", [
      { id: "amma", slot: "left" },
      { id: "kai", slot: "center", expression: "worried", pose: "sit" },
      { id: "maya", slot: "right", action: "point" },
    ], [
      L("maya", "Next I will look in your ears with a little light.", "తర్వాత ఒక చిన్న లైట్‌తో నీ చెవుల్లో చూస్తాను."),
      L("kai", "What if I need a break?", "నాకు విరామం కావాలంటే ఎలా?"),
      L("maya", "Just raise your hand, and I will stop.", "నీ చేయి పైకి ఎత్తు, నేను ఆపేస్తాను."),
    ]),
    scene("a-break", "doctor_room", [
      { id: "amma", slot: "left", action: "nod" },
      { id: "kai", slot: "center", expression: "worried", pose: "sit", action: "raise_hand" },
      { id: "maya", slot: "right" },
    ], [
      L("kai", "Can we stop for a moment?", "కాసేపు ఆపగలమా?"),
      L("maya", "Of course. Let's breathe slowly together.", "తప్పకుండా. మనం కలిసి నెమ్మదిగా శ్వాస తీసుకుందాం."),
      L("kai", "Okay. I'm ready now.", "సరే. ఇప్పుడు నేను సిద్ధంగా ఉన్నాను."),
    ], { camera: { shot: "close", focus: "kai" }, effect: "breathing" }),
    scene("all-done", "doctor_room", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center", expression: "happy", pose: "sit" },
      { id: "maya", slot: "right", expression: "happy" },
    ], [
      L("maya", "All done! You are healthy and strong.", "అయిపోయింది! నువ్వు ఆరోగ్యంగా, బలంగా ఉన్నావు."),
    ], { effect: "sparkles" }),
    scene("home-proud", "home", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center", expression: "happy", action: "hop" },
      { id: "pip", slot: "right", expression: "happy", action: "hop" },
    ], [
      L("amma", "You were so brave at the doctor today.", "ఈరోజు డాక్టర్ దగ్గర నువ్వు చాలా ధైర్యంగా ఉన్నావు."),
      L("kai", "I asked for a break, and then I was ready.", "నేను విరామం అడిగాను, తర్వాత సిద్ధమయ్యాను."),
      L("pip", "Hooray for Kai!", "కైకి హుర్రే!"),
    ], { effect: "sparkles" }),
  ],
};

const TAKING_TURNS: Story = {
  id: "taking-turns",
  title: { en: "Taking turns at the playground", te: "ప్లేగ్రౌండ్‌లో వంతుల వారీగా ఆడటం" },
  summary: { en: "Waiting for a turn on the slide, and what helps while waiting.", te: "జారుడుబల్ల కోసం వంతు చూడటం, ఎదురుచూసేటప్పుడు ఏది సహాయపడుతుంది." },
  scenes: [
    scene("break", "playground", [
      { id: "asha", slot: "left", expression: "happy" },
      { id: "kai", slot: "midleft", expression: "happy", action: "walk_in" },
    ], [
      L("narrator", "It's break time. Kai goes to the playground.", "విరామ సమయం. కై ప్లేగ్రౌండ్‌కి వెళ్తాడు."),
      L("kai", "I want to go on the slide!", "నాకు జారుడుబల్ల మీద జారాలని ఉంది!"),
    ]),
    scene("waiting", "playground", [
      { id: "asha", slot: "left" },
      { id: "kai", slot: "midleft", expression: "worried" },
    ], [
      L("narrator", "Other children are waiting for the slide too.", "ఇంకా పిల్లలు కూడా జారుడుబల్ల కోసం ఎదురుచూస్తున్నారు."),
      L("kai", "But I want to go now.", "కానీ నాకు ఇప్పుడే వెళ్ళాలని ఉంది."),
    ]),
    scene("turns", "playground", [
      { id: "asha", slot: "left", action: "nod" },
      { id: "kai", slot: "midleft", expression: "worried" },
    ], [
      L("asha", "At school we take turns. Everyone gets a turn.", "స్కూల్‌లో మనం వంతుల వారీగా ఆడుకుంటాం. అందరికీ వంతు వస్తుంది."),
      L("asha", "Waiting can feel hard. That's okay.", "ఎదురుచూడటం కష్టంగా అనిపించొచ్చు. పర్వాలేదు."),
    ], { camera: { shot: "medium", focus: "kai" } }),
    scene("breathe", "playground", [
      { id: "asha", slot: "left", pose: "sit" },
      { id: "kai", slot: "midleft", action: "breathe" },
    ], [
      L("asha", "Let's take slow breaths while we wait.", "ఎదురుచూస్తూ మనం నెమ్మదిగా శ్వాస తీసుకుందాం."),
      L("narrator", BREATHE_EN, BREATHE_TE),
      L("kai", "I can count to ten while I wait.", "ఎదురుచూస్తూ నేను పది వరకు లెక్కపెట్టగలను."),
    ], { effect: "breathing" }),
    scene("my-turn", "playground", [
      { id: "asha", slot: "left", expression: "happy", action: "point" },
      { id: "kai", slot: "midleft", expression: "happy" },
    ], [
      L("asha", "Look, Kai. It's your turn now!", "చూడు కై. ఇప్పుడు నీ వంతు!"),
      L("kai", "Yay! My turn!", "హేయ్! నా వంతు!"),
    ]),
    scene("slide", "playground", [
      { id: "asha", slot: "left", expression: "happy" },
      { id: "kai", slot: "right", expression: "happy", action: "hop" },
    ], [
      L("narrator", "Kai goes down the slide. It's so much fun!", "కై జారుడుబల్ల మీద నుంచి జారాడు. చాలా సరదాగా ఉంది!"),
      L("narrator", "Then Kai lets the next child have a turn.", "తర్వాత కై వేరే పిల్లలకు వంతు ఇస్తాడు."),
    ]),
    scene("proud", "playground", [
      { id: "asha", slot: "left", expression: "happy" },
      { id: "kai", slot: "midleft", expression: "happy", action: "hop" },
    ], [
      L("asha", "Well done, Kai. You waited and took turns.", "బాగా చేశావు కై. నువ్వు ఎదురుచూసి, వంతుల వారీగా ఆడావు."),
      L("kai", "Waiting was hard, but I did it!", "ఎదురుచూడటం కష్టంగా ఉంది, కానీ నేను చేశాను!"),
    ], { effect: "sparkles" }),
  ],
};

const FIRE_DRILL: Story = {
  id: "fire-drill",
  title: { en: "Fire drill at school", te: "స్కూల్‌లో ఫైర్ డ్రిల్" },
  summary: { en: "What a fire drill is, the loud alarm, and walking outside together.", te: "ఫైర్ డ్రిల్ అంటే ఏమిటి, గట్టి అలారం, అందరూ కలిసి బయటికి నడవడం." },
  scenes: [
    scene("practice", "classroom", [
      { id: "kai", slot: "midleft", pose: "sit" },
      { id: "asha", slot: "right", expression: "happy" },
    ], [
      L("asha", "Today we will practise a fire drill.", "ఈరోజు మనం ఫైర్ డ్రిల్ ప్రాక్టీస్ చేస్తాం."),
      L("asha", "A fire drill is practice. There is no real fire. It helps us learn to stay safe.", "ఫైర్ డ్రిల్ అంటే ప్రాక్టీస్. నిజంగా మంటలు ఉండవు. సురక్షితంగా ఉండటం నేర్చుకోవడానికి ఇది సహాయపడుతుంది."),
    ]),
    scene("loud", "classroom", [
      { id: "kai", slot: "midleft", expression: "worried", pose: "sit" },
      { id: "asha", slot: "right", action: "nod" },
    ], [
      L("asha", "The alarm will ring. It is very loud.", "అలారం మోగుతుంది. అది చాలా గట్టిగా ఉంటుంది."),
      L("kai", "I don't like loud sounds.", "నాకు పెద్ద శబ్దాలు నచ్చవు."),
      L("asha", "You can cover your ears. I will be right there with you.", "నువ్వు చెవులు మూసుకోవచ్చు. నేను నీతోనే ఉంటాను."),
    ], { camera: { shot: "medium", focus: "kai" } }),
    scene("alarm", "classroom", [
      { id: "kai", slot: "midleft", expression: "surprised", pose: "sit" },
      { id: "asha", slot: "right" },
    ], [
      L("narrator", "The alarm rings. Kai covers his ears.", "అలారం మోగింది. కై చెవులు మూసుకున్నాడు."),
      L("asha", "Everyone, stand up and walk to the door. No running.", "అందరూ లేచి తలుపు దగ్గరికి నడవండి. పరుగెత్తొద్దు."),
    ], { effect: "bell" }),
    scene("line", "classroom", [
      { id: "kai", slot: "midleft", action: "walk_out" },
      { id: "asha", slot: "right", action: "walk_out" },
    ], [
      L("narrator", "Kai walks in a line with his class.", "కై తన క్లాస్‌తో కలిసి వరుసలో నడుస్తాడు."),
    ]),
    scene("outside", "playground", [
      { id: "asha", slot: "left", action: "walk_in" },
      { id: "kai", slot: "midleft", action: "walk_in" },
    ], [
      L("narrator", "The class waits together outside on the playground.", "క్లాస్ అంతా కలిసి బయట ప్లేగ్రౌండ్‌లో ఎదురుచూస్తుంది."),
      L("asha", "Well done, everyone. We are all here and safe.", "అందరూ బాగా చేశారు. మనమంతా ఇక్కడ సురక్షితంగా ఉన్నాం."),
    ]),
    scene("breathe", "playground", [
      { id: "asha", slot: "left" },
      { id: "kai", slot: "midleft", action: "breathe" },
    ], [
      L("kai", "My heart is beating fast.", "నా గుండె వేగంగా కొట్టుకుంటోంది."),
      L("asha", "Let's breathe slowly. In... and out.", "నెమ్మదిగా శ్వాస తీసుకుందాం. లోపలికి... బయటికి."),
    ], { effect: "breathing" }),
    scene("back-inside", "classroom", [
      { id: "kai", slot: "midleft", pose: "sit" },
      { id: "asha", slot: "right", expression: "happy" },
    ], [
      L("narrator", "The drill is over. The class walks back inside.", "డ్రిల్ అయిపోయింది. క్లాస్ అంతా లోపలికి తిరిగి నడుస్తుంది."),
    ]),
    scene("home-proud", "home", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center", expression: "happy", action: "hop" },
      { id: "papa", slot: "right", expression: "happy" },
    ], [
      L("kai", "We did a fire drill today. The alarm was loud, but I covered my ears.", "ఈరోజు మేము ఫైర్ డ్రిల్ చేశాం. అలారం గట్టిగా ఉంది, కానీ నేను చెవులు మూసుకున్నాను."),
      L("papa", "You stayed calm and safe. Well done!", "నువ్వు ప్రశాంతంగా, సురక్షితంగా ఉన్నావు. బాగా చేశావు!"),
    ], { effect: "sparkles" }),
  ],
};

const CHANGE_OF_PLANS: Story = {
  id: "change-of-plans",
  title: { en: "When plans change", te: "ప్లాన్ మారినప్పుడు" },
  summary: { en: "The park is off because of rain, feeling upset, and making a new plan.", te: "వర్షం వల్ల పార్క్ వెళ్ళలేకపోవడం, బాధ, కొత్త ప్లాన్ వేసుకోవడం." },
  scenes: [
    scene("the-plan", "home", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center", expression: "happy" },
      { id: "papa", slot: "right", expression: "happy" },
    ], [
      L("papa", "This afternoon we are going to the park.", "ఈ మధ్యాహ్నం మనం పార్క్‌కి వెళ్తున్నాం."),
      L("kai", "Yay! I love the swings.", "హేయ్! నాకు ఉయ్యాల అంటే చాలా ఇష్టం."),
    ]),
    scene("rain", "home", [
      { id: "amma", slot: "left" },
      { id: "kai", slot: "center", expression: "surprised" },
      { id: "papa", slot: "right" },
    ], [
      L("narrator", "Then it starts to rain. It is raining hard.", "తర్వాత వర్షం మొదలైంది. గట్టిగా వర్షం పడుతోంది."),
      L("papa", "I'm sorry, Kai. We can't go to the park today.", "సారీ కై. ఈరోజు మనం పార్క్‌కి వెళ్ళలేం."),
    ], { camera: { shot: "medium", focus: "kai" } }),
    scene("upset", "home", [
      { id: "amma", slot: "left", action: "nod" },
      { id: "kai", slot: "center", expression: "worried" },
    ], [
      L("kai", "But we said we would go! I feel upset.", "కానీ వెళ్తామని చెప్పారు కదా! నాకు బాధగా ఉంది."),
      L("amma", "It's okay to feel upset when plans change.", "ప్లాన్ మారినప్పుడు బాధపడటం పర్వాలేదు."),
    ], { camera: { shot: "close", focus: "kai" } }),
    scene("breathe", "home", [
      { id: "kai", slot: "midleft", action: "breathe" },
      { id: "pip", slot: "midright", expression: "happy", action: "hop" },
    ], [
      L("pip", "Let's take three slow breaths together.", "మనం కలిసి మూడు సార్లు నెమ్మదిగా శ్వాస తీసుకుందాం."),
      L("narrator", BREATHE_EN, BREATHE_TE),
    ], { effect: "breathing" }),
    scene("new-plan", "home", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center" },
      { id: "papa", slot: "right", expression: "happy", action: "point" },
    ], [
      L("amma", "When plans change, we can make a new plan.", "ప్లాన్ మారినప్పుడు, మనం కొత్త ప్లాన్ వేసుకోవచ్చు."),
      L("papa", "We can build a fort with pillows, and go to the park another day.", "మనం దిండ్లతో ఒక కోట కట్టొచ్చు, పార్క్‌కి ఇంకో రోజు వెళ్ళొచ్చు."),
      L("kai", "Okay. Pillow fort now, park another day.", "సరే. ఇప్పుడు దిండ్ల కోట, పార్క్ ఇంకో రోజు."),
    ]),
    scene("proud", "home", [
      { id: "amma", slot: "left", expression: "happy" },
      { id: "kai", slot: "center", expression: "happy", action: "hop" },
      { id: "pip", slot: "right", expression: "happy", action: "hop" },
    ], [
      L("amma", "You handled the change so well, Kai.", "మార్పుని నువ్వు చాలా బాగా ఎదుర్కొన్నావు, కై."),
      L("kai", "I felt upset, then I breathed, and we made a new plan.", "నాకు బాధ అనిపించింది, తర్వాత శ్వాస తీసుకున్నాను, మేము కొత్త ప్లాన్ వేసుకున్నాం."),
    ], { effect: "sparkles" }),
  ],
};

export const STORY_TEMPLATES: StoryTemplate[] = [
  { key: "new_school", emoji: "🏫", title: NEW_SCHOOL.title, blurb: "Meeting the teacher, the bell, asking for a quiet moment.", script: NEW_SCHOOL },
  { key: "doctor_visit", emoji: "🩺", title: DOCTOR_VISIT.title, blurb: "A check-up step by step, with a break when needed.", script: DOCTOR_VISIT },
  { key: "dentist", emoji: "🦷", title: DENTIST_STORY.title, blurb: "The waiting room, the chair, the mirror, raising a hand.", script: DENTIST_STORY },
  { key: "taking_turns", emoji: "🛝", title: TAKING_TURNS.title, blurb: "Waiting for the slide, and what helps while waiting.", script: TAKING_TURNS },
  { key: "fire_drill", emoji: "🔔", title: FIRE_DRILL.title, blurb: "A loud alarm, walking outside in a line, staying calm.", script: FIRE_DRILL },
  { key: "change_of_plans", emoji: "🌧️", title: CHANGE_OF_PLANS.title, blurb: "Rain stops the park trip; feeling upset; a new plan.", script: CHANGE_OF_PLANS },
];

export const findTemplate = (key: string | null | undefined) => STORY_TEMPLATES.find((t) => t.key === key);

// A fresh, editable copy of a template's script.
export const scriptFromTemplate = (t: StoryTemplate): Story => JSON.parse(JSON.stringify(t.script));
