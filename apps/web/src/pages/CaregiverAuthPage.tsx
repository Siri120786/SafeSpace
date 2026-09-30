import { useState } from "react";
import { signUpCaregiver, logInCaregiver } from "@safespace/api-client";
import type { CaregiverSession } from "@safespace/shared-types";

interface Props {
  onBack: () => void;
  onAuthenticated: (session: CaregiverSession) => void;
}

// Implements the Auth flow from docs/Architecture_Specification.md §2.
// Deliberately does NOT include a child-signup step here — children are
// added from the Caregiver dashboard's Settings tab, not during the
// caregiver's own sign-up, so this stays a single, simple form.
export default function CaregiverAuthPage({ onBack, onAuthenticated }: Props) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email || !password) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    try {
      const result =
        mode === "signup" ? await signUpCaregiver(email, password) : await logInCaregiver(email, password);
      const accessToken = result.session?.access_token;
      if (!accessToken) {
        // Supabase requires email confirmation by default — surface that
        // plainly rather than silently failing.
        setError("Check your email to confirm your account, then log in.");
        return;
      }
      onAuthenticated({ kind: "caregiver", supabaseAccessToken: accessToken });
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <button className="btn-ghost" style={{ marginTop: 0, width: "auto" }} onClick={onBack}>
        ← Back
      </button>
      <div style={{ display: "flex", marginTop: 16, background: "var(--bg-surface-2)", borderRadius: 999, padding: 4 }}>
        <button
          onClick={() => setMode("signup")}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 999, border: "none", cursor: "pointer",
            background: mode === "signup" ? "var(--accent-warm)" : "none",
            color: mode === "signup" ? "#241a10" : "var(--text-muted)", fontWeight: 700,
          }}
        >
          Sign up
        </button>
        <button
          onClick={() => setMode("login")}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 999, border: "none", cursor: "pointer",
            background: mode === "login" ? "var(--accent-warm)" : "none",
            color: mode === "login" ? "#241a10" : "var(--text-muted)", fontWeight: 700,
          }}
        >
          Log in
        </button>
      </div>

      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

      <label htmlFor="password">Password</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

      {error && <div className="error-box">{error}</div>}

      <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </div>
  );
}
