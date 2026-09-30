import { useState } from "react";
import { verifyChildPin } from "@safespace/api-client";
import type { ChildSession } from "@safespace/shared-types";
import { storeChildSession, getStoredFamilyCode, storeFamilyCode } from "../lib/childSessionStorage";

interface Props {
  onBack: () => void;
  onVerified: (session: ChildSession) => void;
}

// Deliberately a PIN, not a password — see the reasoning captured in
// docs/Architecture_Specification.md §6 ("PIN/pattern over password").
// The PIN itself is never checked in this component: verifyChildPin() calls
// a server-side Edge Function, which is the only thing that ever sees
// children.pin_hash (see supabase/migrations/0001_init_schema.sql).
export default function ChildPinPage({ onBack, onVerified }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [familyCode, setFamilyCode] = useState<string | null>(getStoredFamilyCode());
  const [codeInput, setCodeInput] = useState("");

  async function handleDigit(d: string) {
    if (checking) return;
    if (error) {
      setPin("");
      setError(false);
      return;
    }
    if (d === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setChecking(true);
      try {
        const session = await verifyChildPin(familyCode!, next);
        storeChildSession(session);
        onVerified(session);
      } catch {
        setError(true);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 650);
      } finally {
        setChecking(false);
      }
    }
  }

  // First time on this device: ask for the family code once.
  if (!familyCode) {
    return (
      <div className="card">
        <button className="btn-ghost" style={{ marginTop: 0, width: "auto" }} onClick={onBack}>
          ← Back
        </button>
        <h1 style={{ marginTop: 16 }}>Family code</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Ask a grown-up for your family code. You only need to enter it once on this device.
        </p>
        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} maxLength={6} placeholder="e.g. A1B2C3" style={{ textTransform: "uppercase" }} />
        <button
          className="btn-primary"
          disabled={codeInput.trim().length < 6}
          onClick={() => { storeFamilyCode(codeInput); setFamilyCode(codeInput.trim().toUpperCase()); }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <button className="btn-ghost" style={{ marginTop: 0, width: "auto" }} onClick={onBack}>
        ← Back
      </button>
      <h1 style={{ marginTop: 16 }}>Hi! Enter your code</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Ask a grown-up if you forget it</p>

      <div style={{ display: "flex", justifyContent: "center", gap: 14, margin: "22px 0" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 16, height: 16, borderRadius: "50%",
              border: `2px solid ${error ? "var(--danger)" : "var(--text-muted)"}`,
              background: i < pin.length ? (error ? "var(--danger)" : "var(--accent-teal)") : "transparent",
            }}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} onClick={() => handleDigit(String(n))} className="keypad-key">
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => handleDigit("0")} className="keypad-key">0</button>
        <button onClick={() => handleDigit("back")} className="keypad-key">⌫</button>
      </div>

      <style>{`
        .keypad-key {
          aspect-ratio: 1; border-radius: 18px; background: var(--bg-surface-2);
          border: 0.5px solid var(--border); color: var(--text-primary);
          font-size: 22px; font-family: 'Quicksand', sans-serif; font-weight: 600; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
