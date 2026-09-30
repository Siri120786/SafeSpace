import { useEffect, useState } from "react";
import { listMyChildren, addChild, getMyFamilyCode, logOut } from "@safespace/api-client";
import type { Child, ModuleKey } from "@safespace/shared-types";

interface Props {
  onLogOut: () => void;
}

const ALL_MODULES: { key: ModuleKey; name: string }[] = [
  { key: "autism", name: "My Space" },
  { key: "adhd", name: "Focus Zone" },
  { key: "anxiety", name: "Calm Space" },
  { key: "depression", name: "Bright Days" },
  { key: "ptsd", name: "Safe Harbor" },
  { key: "pcos_pcod", name: "Cycle Care" },
];

// Implements the "All inputs / Settings" dashboard from docs/Architecture_
// Specification.md §3. Note what this component does NOT do: it never
// applies its own privacy filtering — listMyChildren() already returns only
// what RLS permits (see supabase/migrations/0001_init_schema.sql). If this
// ever needs "extra" client-side filtering, that's a sign the RLS policy is
// wrong, not a reason to patch it here.
export default function CaregiverDashboardPage({ onLogOut }: Props) {
  const [tab, setTab] = useState<"inputs" | "settings">("inputs");
  const [children, setChildren] = useState<Child[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [familyCode, setFamilyCode] = useState("");

  useEffect(() => {
    listMyChildren().then(setChildren).catch(console.error);
    getMyFamilyCode().then(setFamilyCode).catch(console.error);
  }, []);

  async function handleLogOut() {
    await logOut();
    onLogOut();
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <button className="btn-ghost" style={{ width: "auto", marginTop: 0 }} onClick={handleLogOut}>
          Log out
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
        <button
          onClick={() => setTab("inputs")}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700,
            background: tab === "inputs" ? "var(--accent-teal-soft)" : "var(--bg-surface-2)",
            color: tab === "inputs" ? "var(--accent-teal)" : "var(--text-muted)",
          }}
        >
          All inputs
        </button>
        <button
          onClick={() => setTab("settings")}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700,
            background: tab === "settings" ? "var(--accent-teal-soft)" : "var(--bg-surface-2)",
            color: tab === "settings" ? "var(--accent-teal)" : "var(--text-muted)",
          }}
        >
          Settings
        </button>
      </div>

      {tab === "inputs" ? (
        children.length ? (
          children.map((c) => (
            <div key={c.id} style={{ background: "var(--bg-deep)", borderRadius: 12, padding: 12, marginTop: 10 }}>
              <div style={{ fontWeight: 700 }}>{c.name}, age {c.age}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {c.assignedModules.length
                  ? c.assignedModules.map((m) => ALL_MODULES.find((x) => x.key === m)?.name).join(", ")
                  : "No spaces assigned yet"}
              </div>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 24 }}>
            No linked children yet — add one from Settings.
          </p>
        )
      ) : (
        <>
        {familyCode && (
          <div style={{ background: "var(--bg-deep)", borderRadius: 12, padding: 12, marginTop: 16 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Family code (enter once on your child's device)</div>
            <div style={{ fontFamily: "Quicksand, sans-serif", fontSize: 22, letterSpacing: 4, color: "var(--accent-warm)" }}>{familyCode}</div>
          </div>
        )}
        <SettingsPanel
          showAddChild={showAddChild}
          onToggleAddChild={() => setShowAddChild((v) => !v)}
          onChildAdded={(child) => {
            setChildren((prev) => [...prev, child]);
            setShowAddChild(false);
          }}
        />
        </>
      )}
    </div>
  );
}

function SettingsPanel({
  showAddChild,
  onToggleAddChild,
  onChildAdded,
}: {
  showAddChild: boolean;
  onToggleAddChild: () => void;
  onChildAdded: (c: Child) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [pin, setPin] = useState("");
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [error, setError] = useState("");

  function toggleModule(key: ModuleKey) {
    setModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  async function handleAddChild() {
    setError("");
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    try {
      const childId = await addChild({ name, age: Number(age), pin, modules });
      onChildAdded({ id: childId, caregiverId: "", name, age: Number(age), privacyTier: "full", assignedModules: modules });
    } catch (err: any) {
      setError(err.message ?? "Could not add child.");
    }
  }

  if (!showAddChild) {
    return (
      <button className="btn-primary" onClick={onToggleAddChild}>
        + Add a child profile
      </button>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <label htmlFor="c-name">Child's name</label>
      <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="c-age">Age</label>
      <input id="c-age" type="number" min={4} max={17} value={age} onChange={(e) => setAge(e.target.value)} />
      <label htmlFor="c-pin">4-digit PIN</label>
      <input id="c-pin" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} />
      <label>Assigned spaces</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
        {ALL_MODULES.map((m) => (
          <label
            key={m.key}
            style={{
              display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer",
              background: modules.includes(m.key) ? "var(--accent-teal-soft)" : "var(--bg-deep)",
              border: "0.5px solid var(--border)", borderRadius: 10, padding: "8px 10px",
            }}
          >
            <input type="checkbox" checked={modules.includes(m.key)} onChange={() => toggleModule(m.key)} style={{ width: "auto" }} />
            {m.name}
          </label>
        ))}
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="btn-primary" onClick={handleAddChild}>
        Save child profile
      </button>
    </div>
  );
}
