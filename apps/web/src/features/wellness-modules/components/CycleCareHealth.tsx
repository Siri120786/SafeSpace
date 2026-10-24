import React, { useEffect, useMemo, useState } from "react";
import { useStoredState } from "./useStoredState";
import { FOOD_SHARED_NOTE, foodFocusFor, type Condition } from "../lib/condition";
import { BrainMascot } from "../../../components/vectors/BrainMascot";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DIET_KEY, PROFILE_KEY } from "../lib/deviceStore";
import {
  EMPTY_STATE,
  GENERAL_GUIDANCE,
  GUIDANCE_NOTE,
  MEALS,
  addPlanItem,
  bestStreak,
  characterReaction,
  currentStreak,
  dateKey,
  mealIdeasFor,
  refreshDay,
  removePlanItem,
  sanitizeState,
  starsForDay,
  toggleMeal,
  totalStars,
  type DietState,
  type MealId,
} from "../lib/dietPlan";
import {
  CYCLE_OPTIONS,
  EATING_OPTIONS,
  EMPTY_ASSESSMENT,
  GOAL_OPTIONS,
  HISTORY_OPTIONS,
  NEEDS_OPTIONS,
  PREFERENCE_OPTIONS,
  PROFILE_NOTE,
  SUMMARY_NOTE,
  buildSummary,
  sanitizeAssessment,
  toggleChoice,
  validateAssessment,
  type Assessment,
} from "../lib/healthAssessment";

const fieldClass =
  "w-full rounded-2xl border border-olive-200 bg-white px-4 py-3 text-base text-textBody focus:outline-none focus:ring-2 focus:ring-olive-500";

/** The character hops while it talks. Switched off for low-sensory mode and reduced-motion settings. */
const HOP_CSS = `@keyframes cc-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.cc-hop{animation:cc-hop 1.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.cc-hop{animation:none}}`;

function useCanSpeak(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => setCan(typeof window !== "undefined" && "speechSynthesis" in window), []);
  return can;
}

/** Speaks only when the person presses the button. Nothing plays by itself. */
function speak(text: string) {
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch {
    // speech is optional
  }
}

export const Coach: React.FC<{ stance: React.ComponentProps<typeof BrainMascot>["stance"]; text: string; lowSensory: boolean }> = ({ stance, text, lowSensory }) => {
  const canSpeak = useCanSpeak();
  return (
    <div className="flex flex-col items-center gap-2" role="status" aria-live="polite">
      <style>{HOP_CSS}</style>
      <div className={`pt-14 ${lowSensory ? "" : "cc-hop"}`}>
        <BrainMascot stance={stance} size={150} showBubble bubbleText={text} />
      </div>
      <p className="sr-only">{text}</p>
      {canSpeak && (
        <Button size="sm" variant="outline" onClick={() => speak(text)}>
          Hear it
        </Button>
      )}
    </div>
  );
};

/** Food module body: the diet plan, rewards and character. Reads the food preference from the health profile. */
export const DietSection: React.FC<{ lowSensory: boolean; condition: Condition | null }> = ({ lowSensory, condition }) => {
  const [diet, setDiet, saveFailed] = useStoredState<DietState>(DIET_KEY, EMPTY_STATE, sanitizeState);
  const [profile] = useStoredState<Assessment>(PROFILE_KEY, EMPTY_ASSESSMENT, sanitizeAssessment);
  return (
    <>
      <DietCard diet={diet} setDiet={setDiet} today={dateKey()} preference={profile.preference} lowSensory={lowSensory} condition={condition} />
      <p className="text-sm text-textMuted">
        The diet plan and rewards are kept on this device only, not in your account.
        {saveFailed ? " This browser is not allowing saving, so they will be lost when you leave." : ""}
      </p>
    </>
  );
};

/** Hub body: the optional health profile and its private summary. */
export const ProfileSection: React.FC<{ profile: Assessment; setProfile: (a: Assessment) => void }> = ({ profile, setProfile }) => (
  <ProfileCard profile={profile} setProfile={setProfile} />
);

const DietCard: React.FC<{
  diet: DietState;
  setDiet: (d: DietState) => void;
  today: string;
  preference: Assessment["preference"];
  lowSensory: boolean;
  condition: Condition | null;
}> = ({ diet, setDiet, today, preference, lowSensory, condition }) => {
  const [meal, setMeal] = useState<MealId>("breakfast");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const entry = diet.days[today];
  const streak = currentStreak(diet.days, today);
  const reaction = useMemo(() => characterReaction(entry, new Date().getHours(), streak), [entry, streak]);
  const ticked = diet.ticks[today] ?? [];
  const ideas = mealIdeasFor(meal, preference);

  const add = (value: string) => {
    const r = addPlanItem(diet.plan, meal, value);
    if (!r.ok) return setError(r.error);
    setError(null);
    setDiet(refreshDay({ ...diet, plan: r.plan }, today));
    setText("");
  };

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-xl text-textHeading">Diet plan and rewards</h2>
      <Coach stance={reaction.stance} text={reaction.text} lowSensory={lowSensory} />

      <div className="space-y-2">
        <h3 className="font-medium text-textHeading">General eating tips</h3>
        <ul className="list-disc pl-5 text-base text-textBody space-y-1">
          {[...GENERAL_GUIDANCE, ...foodFocusFor(condition)].map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p className="text-sm text-textBody">{FOOD_SHARED_NOTE}</p>
        <p className="text-sm text-textMuted">{GUIDANCE_NOTE}</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium text-textHeading">My plan for today</h3>
        <p className="text-sm text-textBody">Write the plan your doctor or dietitian gave you, then tick each meal when you have had it.</p>
        <ul className="space-y-3">
          {MEALS.map((m) => (
            <li key={m.id} className="rounded-2xl border border-olive-200 bg-white px-4 py-3 space-y-1">
              <div className="flex items-center gap-3">
                <input
                  id={`meal-${m.id}`}
                  type="checkbox"
                  className="h-5 w-5"
                  disabled={diet.plan[m.id].length === 0}
                  checked={ticked.includes(m.id)}
                  onChange={() => setDiet(toggleMeal(diet, m.id, today))}
                />
                <label htmlFor={`meal-${m.id}`} className="text-base font-medium text-textHeading">
                  {m.label}
                </label>
              </div>
              {diet.plan[m.id].length === 0 ? (
                <p className="text-sm text-textMuted">Nothing planned yet.</p>
              ) : (
                <ul className="text-base text-textBody space-y-1">
                  {diet.plan[m.id].map((item, i) => (
                    <li key={`${item}-${i}`} className="flex items-center justify-between gap-3">
                      <span>{item}</span>
                      <Button size="sm" variant="ghost" aria-label={`Remove ${item}`} onClick={() => setDiet(refreshDay({ ...diet, plan: removePlanItem(diet.plan, m.id, i) }, today))}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium text-textHeading">Add to my plan</h3>
        <label htmlFor="plan-meal" className="block text-sm text-textBody">
          Meal
        </label>
        <select id="plan-meal" className={fieldClass} value={meal} onChange={(e) => setMeal(e.target.value as MealId)}>
          {MEALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <label htmlFor="plan-item" className="block text-sm text-textBody">
          What will you have?
        </label>
        <input id="plan-item" className={fieldClass} value={text} maxLength={120} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" variant="primary" onClick={() => add(text)}>
          Add to plan
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="text-sm text-textBody">Ideas{preference ? " that match your food preference" : ""}, tap to add:</p>
        <div className="flex flex-wrap gap-2">
          {ideas.map((i) => (
            <Button key={i.text} size="sm" variant="outline" onClick={() => add(i.text)}>
              {i.text}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium text-textHeading">Rewards</h3>
        {diet.hideRewards ? (
          <p className="text-sm text-textBody">Stars and streaks are hidden. The character still cheers you on.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 text-center">
            <li className="rounded-2xl bg-white border border-olive-200 px-2 py-3">
              <p className="text-2xl text-textHeading">{starsForDay(entry)}</p>
              <p className="text-xs text-textBody">stars today</p>
            </li>
            <li className="rounded-2xl bg-white border border-olive-200 px-2 py-3">
              <p className="text-2xl text-textHeading">{totalStars(diet.days)}</p>
              <p className="text-xs text-textBody">stars in total</p>
            </li>
            <li className="rounded-2xl bg-white border border-olive-200 px-2 py-3">
              <p className="text-2xl text-textHeading">{streak}</p>
              <p className="text-xs text-textBody">days in a row (best {bestStreak(diet.days)})</p>
            </li>
          </ul>
        )}
        <p className="text-sm text-textMuted">A star for every meal you tick, and a bonus star for finishing the day. A partial day still counts, and you can start a new run any time.</p>
        <Button size="sm" variant="outline" aria-pressed={diet.hideRewards} onClick={() => setDiet({ ...diet, hideRewards: !diet.hideRewards })}>
          {diet.hideRewards ? "Show stars and streaks" : "Hide stars and streaks"}
        </Button>
      </div>
    </Card>
  );
};

const CheckGroup: React.FC<{ legend: string; options: readonly { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }> = ({
  legend,
  options,
  value,
  onChange,
}) => (
  <fieldset className="space-y-1">
    <legend className="text-sm font-medium text-textHeading">{legend}</legend>
    {options.map((o) => (
      <div key={o.id} className="flex items-center gap-3">
        <input id={`${legend}-${o.id}`} type="checkbox" className="h-5 w-5" checked={value.includes(o.id)} onChange={() => onChange(toggleChoice(value, o.id))} />
        <label htmlFor={`${legend}-${o.id}`} className="text-base text-textBody">
          {o.label}
        </label>
      </div>
    ))}
  </fieldset>
);

const NumberField: React.FC<{ id: string; label: string; unit: string; value: string; onChange: (v: string) => void }> = ({ id, label, unit, value, onChange }) => (
  <div>
    <label htmlFor={id} className="block text-sm text-textBody">
      {label} ({unit}, optional)
    </label>
    <input id={id} inputMode="decimal" className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const ProfileCard: React.FC<{ profile: Assessment; setProfile: (a: Assessment) => void }> = ({ profile, setProfile }) => {
  const [showSummary, setShowSummary] = useState(false);
  const set = <K extends keyof Assessment>(k: K, v: Assessment[K]) => setProfile({ ...profile, [k]: v });
  const errors = validateAssessment(profile);
  const summary = buildSummary(profile);

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-xl text-textHeading">My health profile</h2>
      <p className="text-sm text-textBody">{PROFILE_NOTE}</p>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-textHeading">Menstrual cycle patterns</legend>
        <div className="flex flex-wrap gap-2">
          {CYCLE_OPTIONS.map((o) => (
            <Button key={o.id} size="sm" variant={profile.cycle === o.id ? "olive" : "outline"} aria-pressed={profile.cycle === o.id} onClick={() => set("cycle", profile.cycle === o.id ? null : o.id)}>
              {o.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <CheckGroup legend="Health and medical history" options={HISTORY_OPTIONS} value={profile.history} onChange={(v) => set("history", v)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField id="pf-weight" label="Body weight" unit="kg" value={profile.weightKg} onChange={(v) => set("weightKg", v)} />
        <NumberField id="pf-waist" label="Waist" unit="cm" value={profile.waistCm} onChange={(v) => set("waistCm", v)} />
        <NumberField id="pf-glucose" label="Fasting blood glucose" unit="mg/dL" value={profile.fastingGlucose} onChange={(v) => set("fastingGlucose", v)} />
        <NumberField id="pf-hba1c" label="HbA1c" unit="%" value={profile.hba1c} onChange={(v) => set("hba1c", v)} />
      </div>
      <p className="text-sm text-textMuted">Numbers are only for your own summary. SafeSpace does not work out BMI, set a target weight or judge these values.</p>

      <CheckGroup legend="Current eating habits" options={EATING_OPTIONS} value={profile.eating} onChange={(v) => set("eating", v)} />
      <CheckGroup legend="Nutritional requirements" options={NEEDS_OPTIONS} value={profile.needs} onChange={(v) => set("needs", v)} />
      <div>
        <label htmlFor="pf-allergies" className="block text-sm text-textBody">
          Allergies (optional)
        </label>
        <input id="pf-allergies" className={fieldClass} value={profile.allergies} maxLength={200} onChange={(e) => set("allergies", e.target.value)} />
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-textHeading">Food preferences</legend>
        <div className="flex flex-wrap gap-2">
          {PREFERENCE_OPTIONS.map((o) => (
            <Button key={o.id} size="sm" variant={profile.preference === o.id ? "olive" : "outline"} aria-pressed={profile.preference === o.id} onClick={() => set("preference", profile.preference === o.id ? null : o.id)}>
              {o.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="pf-likes" className="block text-sm text-textBody">
          Foods you like or avoid (optional)
        </label>
        <input id="pf-likes" className={fieldClass} value={profile.likes} maxLength={200} onChange={(e) => set("likes", e.target.value)} />
      </div>

      <CheckGroup legend="Individual health goals" options={GOAL_OPTIONS} value={profile.goals} onChange={(v) => set("goals", v)} />
      <div>
        <label htmlFor="pf-goal-note" className="block text-sm text-textBody">
          In your own words (optional)
        </label>
        <input id="pf-goal-note" className={fieldClass} value={profile.goalNote} maxLength={200} onChange={(e) => set("goalNote", e.target.value)} />
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="text-sm text-red-700 space-y-1">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <Button size="sm" variant="primary" aria-expanded={showSummary} onClick={() => setShowSummary((s) => !s)}>
        {showSummary ? "Hide my private summary" : "Show my private summary"}
      </Button>
      {showSummary && (
        <div className="rounded-2xl border border-olive-200 bg-white px-4 py-3 space-y-2">
          {summary.length === 0 ? (
            <p className="text-base text-textBody">Nothing shared yet. Skipping is always fine.</p>
          ) : (
            <ul className="list-disc pl-5 text-base text-textBody space-y-1">
              {summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          <p className="text-sm text-textMuted">{SUMMARY_NOTE}</p>
        </div>
      )}
    </Card>
  );
};
