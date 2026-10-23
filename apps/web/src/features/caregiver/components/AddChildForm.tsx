import React, { useState } from "react";
import { addChild } from "@safespace/api-client";
import { MODULE_KEYS, type ModuleKey } from "@safespace/shared-types";
import { MODULE_LABELS } from "../moduleLabels";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";
import { Chip } from "../../../components/ui/Chip";

const ERROR_MESSAGES: Record<string, string> = {
  pin_already_used_in_family: "Another child in your family already uses this PIN. Pick a different one.",
  invalid_request: "Check the name, age (4 to 17) and 4-digit PIN.",
};

interface Props {
  onAdded: () => void;
  onCancel: () => void;
}

export const AddChildForm: React.FC<Props> = ({ onAdded, onCancel }) => {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [pin, setPin] = useState("");
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageNum = Number(age);
  const valid = name.trim() !== "" && Number.isInteger(ageNum) && ageNum >= 4 && ageNum <= 17 && /^\d{4}$/.test(pin);

  function toggle(m: ModuleKey) {
    setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await addChild({ name: name.trim(), age: ageNum, pin, modules });
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
          <InputField
            label="Age"
            type="number"
            min={4}
            max={17}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            helperText="4 to 17"
          />
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
