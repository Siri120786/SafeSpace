import React from "react";
import { ROUTINE_STEP_ICONS, ROUTINE_STEP_ICON_KEYS, type RoutineStepIcon } from "@safespace/shared-types";
import { DAY_SHORT, WEEK_ORDER, toggleDay, type StepDraft } from "./builders";

const inputClass =
  "w-full rounded-2xl border border-olive-200 bg-white px-3 py-2 text-sm text-textHeading focus:outline-none focus:ring-2 focus:ring-olive-500";

// Days of the week as toggle buttons; none chosen means every day.
export const DayPicker: React.FC<{ value: number[]; onChange: (days: number[]) => void; label?: string }> = ({
  value,
  onChange,
  label = "Days",
}) => (
  <fieldset>
    <legend className="text-sm font-medium text-textHeading mb-1.5">{label}</legend>
    <div className="flex flex-wrap gap-1.5">
      {WEEK_ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggleDay(value, d))}
            className={`min-w-[2.75rem] rounded-xl border px-2 py-1.5 text-xs font-medium ${
              on ? "border-deepGreen bg-deepGreen text-white" : "border-olive-200 bg-white text-textBody"
            }`}
          >
            {DAY_SHORT[d]}
          </button>
        );
      })}
    </div>
    <p className="mt-1 text-[11px] text-textMuted">{value.length === 0 ? "None picked: every day." : "Only on the days picked."}</p>
  </fieldset>
);

export const IconPicker: React.FC<{ value: RoutineStepIcon | null; onChange: (icon: RoutineStepIcon | null) => void; id?: string }> = ({
  value,
  onChange,
  id,
}) => (
  <select
    id={id}
    aria-label="Icon"
    value={value ?? ""}
    onChange={(e) => onChange((e.target.value || null) as RoutineStepIcon | null)}
    className={inputClass}
  >
    <option value="">No icon</option>
    {ROUTINE_STEP_ICON_KEYS.map((k) => (
      <option key={k} value={k}>
        {ROUTINE_STEP_ICONS[k].emoji} {ROUTINE_STEP_ICONS[k].label}
      </option>
    ))}
  </select>
);

// One step's icon, time and name.
export const StepFields: React.FC<{ value: StepDraft; onChange: (s: StepDraft) => void; index?: number }> = ({
  value,
  onChange,
  index,
}) => {
  const n = index === undefined ? "" : ` ${index + 1}`;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[10rem_7rem_1fr] gap-2">
      <IconPicker value={value.icon} onChange={(icon) => onChange({ ...value, icon })} />
      <input
        type="time"
        aria-label={`Step${n} time (optional)`}
        value={value.scheduledTime}
        onChange={(e) => onChange({ ...value, scheduledTime: e.target.value })}
        className={inputClass}
      />
      <input
        type="text"
        aria-label={`Step${n} name`}
        placeholder="e.g. Brush teeth"
        maxLength={120}
        value={value.label}
        onChange={(e) => onChange({ ...value, label: e.target.value })}
        className={inputClass}
      />
    </div>
  );
};

export const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
  type?: string;
}> = ({ label, value, onChange, maxLength, placeholder, type = "text" }) => (
  <label className="block text-sm font-medium text-textHeading">
    {label}
    <input
      type={type}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`mt-1.5 ${inputClass}`}
    />
  </label>
);

export const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <label className="block text-sm font-medium text-textHeading">
    {label}
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${inputClass}`}>
      {children}
    </select>
  </label>
);

// Asks before an irreversible delete, inline rather than a browser dialog.
export const ConfirmButton: React.FC<{ label: string; confirmLabel: string; onConfirm: () => void; disabled?: boolean }> = ({
  label,
  confirmLabel,
  onConfirm,
  disabled,
}) => {
  const [asking, setAsking] = React.useState(false);
  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className="text-xs font-medium text-red-600 underline disabled:opacity-50">
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <button type="button" onClick={() => { setAsking(false); onConfirm(); }} className="rounded-full bg-red-600 px-3 py-1 font-semibold text-white">
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="font-medium text-textMuted underline">
        Cancel
      </button>
    </span>
  );
};
