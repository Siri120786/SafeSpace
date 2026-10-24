import React from "react";
import "../hero/meadowSections.css";

// "What's inside": the three things SafeSpace helps with, in the hero's look.
const FEATURES = [
  {
    icon: "🌱",
    title: "Understand your feelings",
    text: "Check in with how you feel, without judgement. Notice patterns over time and reflect at your own pace.",
  },
  {
    icon: "✅",
    title: "Build small habits",
    text: "Routines in small, clear steps, gentle reminders, and a little celebration for every win.",
  },
  {
    icon: "🍃",
    title: "Find your calm",
    text: "Breathing, grounding, calm sounds and sing-along rhymes for whenever things feel like a lot.",
  },
];

export const FeatureCardsSection: React.FC = () => (
  <section className="ms-section" aria-labelledby="ms-features">
    <div className="ms-head">
      <p className="ms-kicker ms-display">WHAT'S INSIDE</p>
      <h2 id="ms-features" className="ms-title ms-display">
        <span>MADE FOR EVERY</span>
        <span>MOMENT OF YOUR DAY</span>
      </h2>
      <p className="ms-lead">Gentle tools to help you pause, reflect and find your balance again, whenever you need them.</p>
    </div>
    <div className="ms-grid">
      {FEATURES.map((f) => (
        <article key={f.title} className="ms-card ms-card-hover">
          <div className="ms-badge" aria-hidden="true">{f.icon}</div>
          <h3 className="ms-display">{f.title}</h3>
          <p>{f.text}</p>
        </article>
      ))}
    </div>
  </section>
);
