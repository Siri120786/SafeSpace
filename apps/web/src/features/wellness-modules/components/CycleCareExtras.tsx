import React, { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import {
  BODY_KINDNESS_TEXT,
  CHECKIN_FIELDS,
  LEVELS,
  MEDICATION_NOTE,
  MOVEMENT_BY_ENERGY,
  MOVEMENT_NOTE,
  VISIT_PROMPTS,
  WATER_NOTE,
  addNote,
  bumpWater,
  describeCheckIn,
  optionLabel,
  removeNote,
  summarizeCheckIns,
  type CheckIn,
  type Level,
} from "../lib/cycleCare";

const fieldClass =
  "w-full rounded-2xl border border-olive-200 bg-white px-4 py-3 text-base text-textBody focus:outline-none focus:ring-2 focus:ring-olive-500";

/** Pick one option per row, then "Add check-in". Everything is optional. */
export const DailyCheckIn: React.FC = () => {
  const [draft, setDraft] = useState<CheckIn>({});
  const [entries, setEntries] = useState<CheckIn[]>([]);

  const save = () => {
    setEntries((e) => [...e, draft]);
    setDraft({});
  };

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl text-textHeading">How are you today?</h2>
      <p className="text-sm text-textBody">Choose only what you want to. There are no right answers.</p>
      {CHECKIN_FIELDS.map((f) => (
        <fieldset key={f.id} className="space-y-1">
          <legend className="text-sm font-medium text-textHeading">{f.label}</legend>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((lv) => (
              <Button
                key={lv}
                size="sm"
                variant={draft[f.id] === lv ? "olive" : "outline"}
                aria-pressed={draft[f.id] === lv}
                onClick={() => setDraft((d) => ({ ...d, [f.id]: d[f.id] === lv ? undefined : (lv as Level) }))}
              >
                {optionLabel(f, lv)}
              </Button>
            ))}
          </div>
        </fieldset>
      ))}
      <p role="status" className="text-sm text-textBody">
        {describeCheckIn(draft)}
      </p>
      <Button size="sm" variant="primary" onClick={save}>
        Add check-in
      </Button>
      <p className="text-sm text-textBody">{summarizeCheckIns(entries)}</p>
    </Card>
  );
};

export const MovementPicker: React.FC = () => {
  const [energy, setEnergy] = useState<Level | null>(null);
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl text-textHeading">Movement for your energy</h2>
      <div className="flex flex-wrap gap-2">
        {LEVELS.map((lv) => (
          <Button key={lv} size="sm" variant={energy === lv ? "olive" : "outline"} aria-pressed={energy === lv} onClick={() => setEnergy(lv)}>
            {optionLabel(CHECKIN_FIELDS[0], lv)}
          </Button>
        ))}
      </div>
      {energy && (
        <ul className="list-disc pl-5 text-base text-textBody space-y-1">
          {MOVEMENT_BY_ENERGY[energy].map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <p className="text-sm text-textMuted">{MOVEMENT_NOTE}</p>
    </Card>
  );
};

const NoteList: React.FC<{
  idPrefix: string;
  label: string;
  addLabel: string;
  items: string[];
  setItems: (items: string[]) => void;
}> = ({ idPrefix, label, addLabel, items, setItems }) => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = (value: string) => {
    const r = addNote(items, value);
    if (!r.ok) return setError(r.error);
    setError(null);
    setItems(r.items);
    setText("");
  };
  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-input`} className="block text-sm text-textBody">
        {label}
      </label>
      <input id={`${idPrefix}-input`} className={fieldClass} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" variant="primary" onClick={() => add(text)}>
        {addLabel}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={`${it}-${i}`} className="flex items-center justify-between gap-3 text-base text-textBody">
            <span>{it}</span>
            <Button size="sm" variant="ghost" aria-label={`Remove ${it}`} onClick={() => setItems(removeNote(items, i))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const DoctorVisitPrep: React.FC<{ prompts?: readonly string[] }> = ({ prompts = VISIT_PROMPTS }) => {
  const [questions, setQuestions] = useState<string[]>([]);
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl text-textHeading">Doctor visit prep</h2>
      <p className="text-sm text-textBody">Tap an idea to add it to your list, or write your own.</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((q) => (
          <Button
            key={q}
            size="sm"
            variant="outline"
            onClick={() => {
              const r = addNote(questions, q);
              if (r.ok) setQuestions(r.items);
            }}
          >
            {q}
          </Button>
        ))}
      </div>
      <NoteList idPrefix="visit" label="Add your own question" addLabel="Add question" items={questions} setItems={setQuestions} />
    </Card>
  );
};

export const MedicationNotes: React.FC = () => {
  const [notes, setNotes] = useState<string[]>([]);
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl text-textHeading">My medicine and supplement notes</h2>
      <NoteList idPrefix="meds" label="Name and when you take it, as your doctor told you" addLabel="Add note" items={notes} setItems={setNotes} />
      <p className="text-sm text-textMuted">{MEDICATION_NOTE}</p>
    </Card>
  );
};

export const WaterTally: React.FC = () => {
  const [glasses, setGlasses] = useState(0);
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl text-textHeading">Water so far today</h2>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" aria-label="Remove a glass" disabled={glasses === 0} onClick={() => setGlasses((g) => bumpWater(g, -1))}>
          -
        </Button>
        <p role="status" className="text-lg text-textHeading">
          {glasses} {glasses === 1 ? "glass" : "glasses"}
        </p>
        <Button size="sm" variant="outline" aria-label="Add a glass" onClick={() => setGlasses((g) => bumpWater(g, 1))}>
          +
        </Button>
      </div>
      <p className="text-sm text-textMuted">{WATER_NOTE}</p>
    </Card>
  );
};

export const BodyKindness: React.FC = () => (
  <p role="note" className="rounded-2xl bg-white/80 border border-olive-200 px-4 py-3 text-sm text-textBody">
    {BODY_KINDNESS_TEXT}
  </p>
);
