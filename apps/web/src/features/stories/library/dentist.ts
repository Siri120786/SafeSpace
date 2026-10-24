import type { Story } from "../storyScript";

// "Kai visits the dentist": the first built-in social story. Follows the beats
// of the Flow version (home, getting ready, the clinic, Dr. Maya, the chair,
// home again) and adds the coping step it lacked: raising a hand to pause.
// Telugu lines are a first draft and need a native speaker's check
// (docs/content-needing-review.md).
export const DENTIST_STORY: Story = {
  id: "kai-visits-the-dentist",
  title: { en: "Kai visits the dentist", te: "కై డెంటిస్ట్ దగ్గరికి వెళ్తాడు" },
  summary: {
    en: "What happens at the dentist, and how to ask for a break.",
    te: "డెంటిస్ట్ దగ్గర ఏమి జరుగుతుంది, విరామం ఎలా అడగాలి.",
  },
  scenes: [
    {
      id: "home-news",
      background: "home",
      cast: [
        { id: "amma", slot: "left", expression: "happy" },
        { id: "kai", slot: "center", expression: "calm" },
        { id: "papa", slot: "right", expression: "happy" },
      ],
      lines: [
        { speaker: "amma", en: "Kai, today we are going to visit the dentist.", te: "కై, ఈరోజు మనం డెంటిస్ట్ దగ్గరికి వెళ్తున్నాం." },
        { speaker: "papa", en: "The dentist checks your teeth to keep them strong.", te: "నీ పళ్ళు గట్టిగా ఉండేలా డెంటిస్ట్ చూస్తారు." },
      ],
    },
    {
      id: "home-worry",
      background: "home",
      camera: { shot: "medium", focus: "kai" },
      cast: [
        { id: "amma", slot: "left", expression: "calm", action: "nod" },
        { id: "kai", slot: "center", expression: "worried" },
        { id: "papa", slot: "right", expression: "calm" },
      ],
      lines: [
        { speaker: "kai", en: "I feel a little scared.", te: "నాకు కొంచెం భయంగా ఉంది." },
        { speaker: "amma", en: "It's okay to feel scared. We will be with you.", te: "భయపడటం పర్వాలేదు. మేము నీతోనే ఉంటాం." },
      ],
    },
    {
      id: "home-breathe",
      background: "home",
      effect: "breathing",
      cast: [
        { id: "kai", slot: "midleft", expression: "calm", action: "breathe" },
        { id: "pip", slot: "midright", expression: "happy", action: "hop" },
      ],
      lines: [
        { speaker: "pip", en: "Let's take three slow breaths together.", te: "మనం కలిసి మూడు సార్లు నెమ్మదిగా శ్వాస తీసుకుందాం." },
        { speaker: "narrator", en: "Breathe in slowly... and breathe out.", te: "నెమ్మదిగా శ్వాస లోపలికి తీసుకో... బయటికి వదులు." },
        { speaker: "kai", en: "I feel a bit calmer.", te: "నాకు కొంచెం ప్రశాంతంగా ఉంది." },
      ],
    },
    {
      id: "getting-ready",
      background: "front_door",
      cast: [
        { id: "kai", slot: "midleft", expression: "calm", action: "walk_out", holding: "teddy" },
        { id: "amma", slot: "midright", expression: "happy", action: "walk_out" },
      ],
      lines: [
        { speaker: "narrator", en: "Kai puts on his shoes. It's time to go.", te: "కై బూట్లు వేసుకున్నాడు. వెళ్ళే సమయం అయ్యింది." },
        { speaker: "amma", en: "Pip can come too!", te: "పిప్ కూడా మనతో రావచ్చు!" },
      ],
    },
    {
      id: "clinic-arrive",
      background: "clinic_outside",
      cast: [
        { id: "amma", slot: "left", expression: "calm", action: "walk_in" },
        { id: "kai", slot: "midleft", expression: "calm", action: "walk_in" },
        { id: "papa", slot: "center", expression: "happy", action: "walk_in" },
      ],
      lines: [
        { speaker: "papa", en: "Here we are. This is the dental clinic.", te: "వచ్చేశాం. ఇదే డెంటల్ క్లినిక్." },
      ],
    },
    {
      id: "waiting-room",
      background: "waiting_room",
      cast: [
        { id: "amma", slot: "left", expression: "calm", pose: "sit" },
        { id: "kai", slot: "midleft", expression: "calm", pose: "sit", holding: "teddy" },
      ],
      lines: [
        { speaker: "narrator", en: "The waiting room has toys and books. Kai waits with Amma.", te: "వెయిటింగ్ రూమ్‌లో బొమ్మలు, పుస్తకాలు ఉన్నాయి. కై అమ్మతో కలిసి ఎదురుచూస్తాడు." },
        { speaker: "narrator", en: "Sometimes we have to wait a little while.", te: "కొన్నిసార్లు మనం కొంచెం సేపు వేచి ఉండాలి." },
      ],
    },
    {
      id: "meet-maya",
      background: "waiting_room",
      cast: [
        { id: "amma", slot: "left", expression: "happy" },
        { id: "kai", slot: "midleft", expression: "surprised" },
        { id: "maya", slot: "midright", expression: "happy", action: "walk_in" },
      ],
      lines: [
        { speaker: "maya", en: "Hello Kai! I'm Dr. Maya. I'm happy to meet you.", te: "హలో కై! నేను డాక్టర్ మాయ. నిన్ను కలవడం సంతోషంగా ఉంది." },
        { speaker: "kai", en: "Hello, Dr. Maya.", te: "హలో, డాక్టర్ మాయ." },
      ],
    },
    {
      id: "the-chair",
      background: "dental_room",
      cast: [
        { id: "amma", slot: "left", expression: "calm" },
        { id: "kai", slot: "center", expression: "calm", pose: "sit" },
        { id: "maya", slot: "right", expression: "happy", action: "point" },
      ],
      lines: [
        { speaker: "maya", en: "This is my special chair. It can go up and down.", te: "ఇది నా ప్రత్యేకమైన కుర్చీ. ఇది పైకి, కిందికి కదులుతుంది." },
        { speaker: "narrator", en: "Kai sits in the chair. Amma stays close.", te: "కై కుర్చీలో కూర్చున్నాడు. అమ్మ దగ్గరే ఉంది." },
      ],
    },
    {
      id: "the-mirror",
      background: "dental_room",
      cast: [
        { id: "amma", slot: "left", expression: "calm" },
        { id: "kai", slot: "center", expression: "worried", pose: "sit" },
        { id: "maya", slot: "right", expression: "calm", holding: "mirror" },
      ],
      lines: [
        { speaker: "maya", en: "I will use a little mirror to count your teeth.", te: "నీ పళ్ళను లెక్కపెట్టడానికి నేను ఒక చిన్న అద్దం వాడతాను." },
        { speaker: "kai", en: "What if I need a break?", te: "నాకు విరామం కావాలంటే ఎలా?" },
        { speaker: "maya", en: "Just raise your hand, and I will stop.", te: "నీ చేయి పైకి ఎత్తు, నేను ఆపేస్తాను." },
      ],
    },
    {
      id: "a-break",
      background: "dental_room",
      camera: { shot: "close", focus: "kai" },
      effect: "breathing",
      cast: [
        { id: "amma", slot: "left", expression: "calm", action: "nod" },
        { id: "kai", slot: "center", expression: "worried", pose: "sit", action: "raise_hand" },
        { id: "maya", slot: "right", expression: "calm" },
      ],
      lines: [
        { speaker: "kai", en: "Can we stop for a moment?", te: "కాసేపు ఆపగలమా?" },
        { speaker: "maya", en: "Of course. Let's breathe together.", te: "తప్పకుండా. మనం కలిసి శ్వాస తీసుకుందాం." },
        { speaker: "narrator", en: "Kai breathes slowly. Dr. Maya waits.", te: "కై నెమ్మదిగా శ్వాస తీసుకుంటాడు. డాక్టర్ మాయ ఎదురుచూస్తారు." },
      ],
    },
    {
      id: "all-done",
      background: "dental_room",
      effect: "sparkles",
      cast: [
        { id: "amma", slot: "left", expression: "happy" },
        { id: "kai", slot: "center", expression: "happy", pose: "sit" },
        { id: "maya", slot: "right", expression: "happy", holding: "toothbrush" },
      ],
      lines: [
        { speaker: "kai", en: "I'm ready now.", te: "ఇప్పుడు నేను సిద్ధంగా ఉన్నాను." },
        { speaker: "maya", en: "All done! Your teeth are shiny and strong.", te: "అయిపోయింది! నీ పళ్ళు మెరుస్తూ, గట్టిగా ఉన్నాయి." },
      ],
    },
    {
      id: "home-proud",
      background: "home",
      effect: "sparkles",
      cast: [
        { id: "amma", slot: "left", expression: "happy" },
        { id: "kai", slot: "center", expression: "happy", action: "hop" },
        { id: "pip", slot: "right", expression: "happy", action: "hop" },
      ],
      lines: [
        { speaker: "amma", en: "You were so brave today, Kai.", te: "ఈరోజు నువ్వు చాలా ధైర్యంగా ఉన్నావు, కై." },
        { speaker: "kai", en: "I did it! And I asked for a break when I needed one.", te: "నేను చేశాను! నాకు అవసరమైనప్పుడు విరామం అడిగాను." },
        { speaker: "pip", en: "Hooray for Kai!", te: "కైకి హుర్రే!" },
      ],
    },
  ],
};
