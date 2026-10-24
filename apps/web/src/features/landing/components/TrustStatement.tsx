import React from "react";
import "../hero/meadowSections.css";

// "Our promise": what SafeSpace is and isn't, in three frosted cards.
const PILLARS = [
  {
    icon: "🌿",
    title: "Support without stigma",
    text: "Tools for routines, focus, senses and feelings that fit your rhythm, not a label.",
  },
  {
    icon: "🛡️",
    title: "Privacy with dignity",
    text: "Young people's privacy grows with their age, and safety alerts always reach a grown-up when it matters.",
  },
  {
    icon: "🤝",
    title: "Caregivers, alongside",
    text: "Caregivers get calm tools and a clear view of what helps, without watching every move.",
  },
];

export const TrustStatement: React.FC = () => (
  <section className="ms-section" aria-labelledby="ms-promise">
    <div className="ms-head">
      <p className="ms-kicker ms-display">OUR PROMISE</p>
      <h2 id="ms-promise" className="ms-title ms-display">
        <span>YOUR SPACE,</span>
        <span>YOUR CHOICES</span>
      </h2>
      <p className="ms-lead">
        SafeSpace supports wellbeing, reflection and everyday coping. It never diagnoses.
      </p>
    </div>
    <div className="ms-grid">
      {PILLARS.map((p) => (
        <article key={p.title} className="ms-card">
          <div className="ms-badge" aria-hidden="true">{p.icon}</div>
          <h3 className="ms-display">{p.title}</h3>
          <p>{p.text}</p>
        </article>
      ))}
    </div>
  </section>
);

export default TrustStatement;
