import React from "react";
import "../hero/meadowSections.css";

interface EntryChoiceCardProps {
  onChooseCaregiver: () => void;
  onChooseChild: () => void;
}

// "Come on in": the two ways into SafeSpace (an adult's account, or a child's
// family code and PIN), as frosted cards.
export const EntryChoiceCard: React.FC<EntryChoiceCardProps> = ({ onChooseCaregiver, onChooseChild }) => (
  <section className="ms-section" aria-labelledby="ms-entry">
    <div className="ms-head">
      <p className="ms-kicker ms-display">COME ON IN</p>
      <h2 id="ms-entry" className="ms-title ms-display">
        <span>HOW WOULD YOU</span>
        <span>LIKE TO ENTER?</span>
      </h2>
      <p className="ms-lead">Choose your way in. Each one opens a space made for you.</p>
    </div>

    <div className="ms-grid ms-grid-2">
      <article className="ms-card ms-card-hover flex flex-col">
        <span className="ms-tag">Individuals &amp; caregivers</span>
        <div className="ms-badge" aria-hidden="true">🌿</div>
        <h3 className="ms-display">I'm an adult</h3>
        <p>Sign in for your own wellbeing, or to support a child you care for.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="ms-pill ms-pill-green" onClick={onChooseCaregiver}>
            Log in <span aria-hidden="true">→</span>
          </button>
        </div>
      </article>

      <article className="ms-card ms-card-hover flex flex-col">
        <span className="ms-tag">Family code &amp; PIN</span>
        <div className="ms-badge" aria-hidden="true">🧒</div>
        <h3 className="ms-display">I'm a child</h3>
        <p>Use your family code and your secret PIN to open your own space.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="ms-pill ms-pill-glass" onClick={onChooseChild}>
            Enter my space <span aria-hidden="true">→</span>
          </button>
        </div>
      </article>
    </div>
  </section>
);

export default EntryChoiceCard;
