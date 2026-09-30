import { useEffect, useState } from "react";
import { getMyChildProfile, logOut } from "@safespace/api-client";
import type { Child, ModuleKey } from "@safespace/shared-types";
import { getStoredChildSession, clearChildSession } from "../lib/childSessionStorage";

interface Props {
  onLogOut: () => void;
}

const MODULE_META: Record<ModuleKey, { name: string }> = {
  autism: { name: "My Space" },
  adhd: { name: "Focus Zone" },
  anxiety: { name: "Calm Space" },
  depression: { name: "Bright Days" },
  ptsd: { name: "Safe Harbor" },
  pcos_pcod: { name: "Cycle Care" },
};

// Implements the exact branching logic from docs/Architecture_Specification.md
// §4 / the "home_picker_branching_logic" diagram:
//   0 modules -> empty state (previously an unresolved gap — now handled)
//   1 module  -> opens that module's home directly, skipping the picker
//   2+ modules -> picker screen, one card per module
export default function UserViewPage({ onLogOut }: Props) {
  const [child, setChild] = useState<Child | null>(null);
  const [openModule, setOpenModule] = useState<ModuleKey | null>(null);

  useEffect(() => {
    const session = getStoredChildSession();
    if (!session) {
      onLogOut();
      return;
    }
    getMyChildProfile(session)
      .then((c) => {
        setChild(c);
        if (c.assignedModules.length === 1) {
          setOpenModule(c.assignedModules[0]);
        }
      })
      .catch(() => onLogOut());
  }, []);

  async function handleLogOut() {
    clearChildSession();
    await logOut().catch(() => {}); // no-op for a child session, kept for symmetry
    onLogOut();
  }

  if (!child) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading your space…</p>
      </div>
    );
  }

  // Gap #1 from docs/Architecture_Specification.md §8, now resolved here:
  if (child.assignedModules.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <h1>Hi {child.name}!</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 10 }}>
          No spaces have been set up for you yet.
          <br />
          Ask your caregiver to add one in Settings.
        </p>
        <button className="btn-ghost" onClick={handleLogOut}>
          Log out
        </button>
      </div>
    );
  }

  if (openModule) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <h1>{MODULE_META[openModule].name}</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 10 }}>
          This is a placeholder screen — the real tools for this space aren't built yet.
        </p>
        {child.assignedModules.length > 1 && (
          <button className="btn-ghost" onClick={() => setOpenModule(null)}>
            ← Choose a different space
          </button>
        )}
        <button className="btn-ghost" onClick={handleLogOut}>
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Hi {child.name}!</p>
      <h1 style={{ textAlign: "center" }}>Where do you want to go?</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
        {child.assignedModules.map((key) => (
          <button
            key={key}
            onClick={() => setOpenModule(key)}
            style={{
              display: "flex", alignItems: "center", gap: 14, padding: 18, borderRadius: 16,
              border: "none", cursor: "pointer", textAlign: "left",
              background: "var(--accent-teal-soft)", color: "var(--accent-teal)",
            }}
          >
            <span style={{ fontFamily: "Quicksand, sans-serif", fontWeight: 700, fontSize: 16 }}>
              {MODULE_META[key].name}
            </span>
          </button>
        ))}
      </div>
      <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-muted)", marginTop: 20 }}>
        You can switch anytime
      </p>
    </div>
  );
}
