import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { isValidChildBirth, resetChildPin, setChildModules, updateChild } from "@safespace/api-client";
import { CHILD_THEMES, MODULE_KEYS, type Child, type ChildTheme, type ModuleKey } from "@safespace/shared-types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import {
  CaregiverPageShell,
  ROLE_LABELS,
  SHARING_LABELS,
  SelectField,
  THEME_LABELS,
  TextField,
  canDo,
  caregiverChildPath,
  manageErrorText,
  useCaregiverChild,
  validatePinPair,
} from "../features/caregiver";
import { MODULE_LABELS } from "../features/caregiver/moduleLabels";
import { ROUTES } from "../routes";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// /caregiver/children/:childId/settings (docs/role-flow/CONTRACT.md D4 and
// section 4). Details and PIN: primary only. Modules and appearance: any caregiver.
export const CaregiverChildSettingsPage: React.FC = () => {
  const { childId = "" } = useParams();
  const { child, error, reload } = useCaregiverChild(childId);

  if (error === "not_found") {
    return (
      <CaregiverPageShell title="Child not found" backTo={ROUTES.CAREGIVER_HOME}>
        <Card><p className="text-textBody">This child isn't one of yours, or no longer is.</p></Card>
      </CaregiverPageShell>
    );
  }
  if (!child) {
    return (
      <CaregiverPageShell title="Settings" backTo={caregiverChildPath(childId)} backLabel="Back">
        {error ? <p role="alert" className="text-sm text-red-700">Couldn't load this child right now.</p> : <p className="text-textBody">Loading...</p>}
      </CaregiverPageShell>
    );
  }

  return (
    <CaregiverPageShell
      title={`${child.name}'s settings`}
      subtitle={child.myRole ? ROLE_LABELS[child.myRole] : undefined}
      backTo={caregiverChildPath(childId)}
      backLabel={`Back to ${child.name}`}
    >
      <DetailsCard child={child} onSaved={reload} />
      <ModulesCard child={child} onSaved={reload} />
      <AppearanceCard child={child} onSaved={reload} />
      <SharingCard child={child} />
      <PinCard child={child} />
    </CaregiverPageShell>
  );
};

// Shared save state for each card: saving, a message, and a run helper.
function useSaver() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, done = "Saved.") => {
    setSaving(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: done });
      return true;
    } catch (e) {
      setMessage({ ok: false, text: manageErrorText(e) });
      return false;
    } finally {
      setSaving(false);
    }
  };
  const note = message && (
    <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-deepGreen" : "text-red-700"}`}>{message.text}</p>
  );
  return { saving, run, note, setMessage };
}

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <Card className="p-6 space-y-4 border border-olive-100">
    <div>
      <h2 className="font-display text-lg font-medium text-textHeading">{title}</h2>
      {hint && <p className="text-xs text-textMuted mt-0.5">{hint}</p>}
    </div>
    {children}
  </Card>
);

const DetailsCard: React.FC<{ child: Child; onSaved: () => void }> = ({ child, onSaved }) => {
  const editable = canDo(child.myRole, "edit_details");
  const [name, setName] = useState(child.name);
  const [month, setMonth] = useState(String(child.birthMonth));
  const [year, setYear] = useState(String(child.birthYear));
  const { saving, run, note, setMessage } = useSaver();

  async function save() {
    if (!name.trim()) return setMessage({ ok: false, text: "Enter a name." });
    if (!isValidChildBirth(Number(year), Number(month))) {
      return setMessage({ ok: false, text: "Birth month and year must give an age of 4 to 17." });
    }
    if (await run(() => updateChild(child.id, { name: name.trim(), birthYear: Number(year), birthMonth: Number(month) }))) onSaved();
  }

  if (!editable) {
    return (
      <Section title="Details" hint="Only the primary caregiver can change these.">
        <p className="text-sm text-textBody">{child.name}, born {MONTHS[child.birthMonth - 1]} {child.birthYear} (age {child.ageYears})</p>
      </Section>
    );
  }
  return (
    <Section title="Details" hint="Their age updates on its own from the birth month and year.">
      <TextField label="Name" value={name} onChange={setName} maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Birth month" value={month} onChange={setMonth}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </SelectField>
        <TextField label="Birth year" type="number" value={year} onChange={setYear} />
      </div>
      {note}
      <div className="flex justify-end"><Button variant="olive" size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save details"}</Button></div>
    </Section>
  );
};

const ModulesCard: React.FC<{ child: Child; onSaved: () => void }> = ({ child, onSaved }) => {
  const [modules, setModules] = useState<ModuleKey[]>(child.assignedModules);
  const { saving, run, note } = useSaver();
  useEffect(() => setModules(child.assignedModules), [child.assignedModules]);
  const toggle = (m: ModuleKey) => setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  return (
    <Section title="Support areas" hint={`Shape which tools and content ${child.name} sees first.`}>
      <div className="flex flex-wrap gap-2">
        {MODULE_KEYS.map((m) => (
          <Chip key={m} label={MODULE_LABELS[m]} active={modules.includes(m)} onClick={() => toggle(m)} variant="olive" size="sm" />
        ))}
      </div>
      {note}
      <div className="flex justify-end">
        <Button variant="olive" size="sm" disabled={saving} onClick={async () => { if (await run(() => setChildModules(child.id, modules))) onSaved(); }}>
          {saving ? "Saving..." : "Save support areas"}
        </Button>
      </div>
    </Section>
  );
};

const AppearanceCard: React.FC<{ child: Child; onSaved: () => void }> = ({ child, onSaved }) => {
  const [theme, setTheme] = useState<ChildTheme | "">(child.theme ?? "");
  const [locked, setLocked] = useState(child.themeLocked);
  const [lowSensory, setLowSensory] = useState(child.lowSensoryDefault);
  const { saving, run, note } = useSaver();
  return (
    <Section title="Look and feel" hint={`How ${child.name}'s space looks when they sign in.`}>
      <SelectField label="Theme" value={theme} onChange={(v) => setTheme(v as ChildTheme | "")}>
        <option value="">No theme</option>
        {CHILD_THEMES.map((t) => <option key={t} value={t}>{THEME_LABELS[t]}</option>)}
      </SelectField>
      <label className="flex items-start gap-3 text-sm text-textHeading">
        <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="mt-1 h-4 w-4 accent-deepGreen" />
        <span>
          Keep this theme
          <span className="block text-xs text-textMuted">{child.name} can't change it themself while this is on.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-textHeading">
        <input type="checkbox" checked={lowSensory} onChange={(e) => setLowSensory(e.target.checked)} className="mt-1 h-4 w-4 accent-deepGreen" />
        <span>
          Start in low-sensory mode
          <span className="block text-xs text-textMuted">Calmer colours and no motion when {child.name} signs in.</span>
        </span>
      </label>
      {note}
      <div className="flex justify-end">
        <Button
          variant="olive"
          size="sm"
          disabled={saving}
          onClick={async () => { if (await run(() => updateChild(child.id, { theme: theme || null, themeLocked: locked, lowSensoryDefault: lowSensory }))) onSaved(); }}
        >
          {saving ? "Saving..." : "Save look and feel"}
        </Button>
      </div>
    </Section>
  );
};

// Read-only: only the young person can change it (D8).
const SharingCard: React.FC<{ child: Child }> = ({ child }) => (
  <Section title="Sharing">
    <p className="text-sm text-textBody">{SHARING_LABELS[child.sharing]}</p>
    <p className="text-xs text-textMuted">
      {child.ageYears < 15
        ? `From 15, ${child.name} chooses whether you see their activity. Alerts always reach you.`
        : `Only ${child.name} can change this, in their own settings. Alerts always reach you.`}
    </p>
  </Section>
);

const PinCard: React.FC<{ child: Child }> = ({ child }) => {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const { saving, run, note, setMessage } = useSaver();
  if (!canDo(child.myRole, "reset_pin")) {
    return (
      <Section title="PIN">
        <p className="text-sm text-textBody">Only the primary caregiver can reset {child.name}'s PIN.</p>
      </Section>
    );
  }
  async function reset() {
    const p = validatePinPair(pin, confirm);
    if (p) return setMessage({ ok: false, text: p });
    if (await run(() => resetChildPin(child.id, pin), `PIN changed. ${child.name} has been signed out and signs in with the new PIN.`)) {
      setPin("");
      setConfirm("");
    }
  }
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  return (
    <Section title="Reset PIN" hint={`This signs ${child.name} out on every device.`}>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="New 4-digit PIN" type="password" value={pin} onChange={(v) => setPin(digits(v))} />
        <TextField label="Type it again" type="password" value={confirm} onChange={(v) => setConfirm(digits(v))} />
      </div>
      {note}
      <div className="flex justify-end"><Button variant="olive" size="sm" onClick={reset} disabled={saving}>{saving ? "Saving..." : "Reset PIN"}</Button></div>
    </Section>
  );
};

export default CaregiverChildSettingsPage;
