import React, { useState } from "react";
import { addChild, isValidChildBirth } from "@safespace/api-client";
import { MODULE_KEYS, type ModuleKey } from "@safespace/shared-types";
import { MODULE_LABELS } from "../moduleLabels";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";
import { Chip } from "../../../components/ui/Chip";

const ERROR_MESSAGES: Record<string, string> = {
  pin_already_used_in_family: "Another child in your family already uses this PIN. Pick a different one.",
  invalid_request: "Check the name, birth month and year (age 4 to 17) and 4-digit PIN.",
  invalid_input: "Check the birth month and year: your child must be 4 to 17.",
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

interface Props {
  onAdded: () => void;
  onCancel: () => void;
}

export const AddChildForm: React.FC<Props> = ({ onAdded, onCancel }) => {
  const [name, setName] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [pin, setPin] = useState("");
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim() !== "" && isValidChildBirth(Number(birthYear), Number(birthMonth)) && /^\d{4}$/.test(pin);

  function toggle(m: ModuleKey) {
    setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await addChild({ name: name.trim(), birthYear: Number(birthYear), birthMonth: Number(birthMonth), pin, modules });
      onAdded();
    } catch (err: unknown) {
      const code = (err as Error).message;
      setError(ERROR_MESSAGES[code] ?? "Couldn't add the child right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6 space-y-5 border border-olive-100">
      <h3 className="font-display text-lg font-medium text-textHeading">Add a child</h3>
      <form onSubmit={submit} className="space-y-4">
        <InputField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-textHeading">
            Birth month
            <select
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              className="rounded-2xl border border-olive-200 bg-white px-4 py-3 text-sm font-normal"
            >
              <option value="">Month</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <InputField
            label="Birth year"
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            helperText="Ages 4 to 17"
          />
        </div>
        <div>
          <InputField
            label="4-digit PIN"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoComplete="off"
            helperText="They enter this with your family code"
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium text-textHeading">Support areas</span>
          <div className="flex flex-wrap gap-2">
            {MODULE_KEYS.map((m) => (
              <Chip key={m} label={MODULE_LABELS[m]} active={modules.includes(m)} onClick={() => toggle(m)} variant="olive" size="sm" />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="olive" size="sm" disabled={!valid || saving}>
            {saving ? "Adding..." : "Add child"}
          </Button>
        </div>
      </form>
    </Card>
  );
};
