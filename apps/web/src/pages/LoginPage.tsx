import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { chosenRole, landingFor, roleOf, RoleChoice, useAuth } from "../features/auth";
import { Card } from "../components/ui/Card";
import { InputField } from "../components/ui/InputField";
import { Button } from "../components/ui/Button";
import { BrainMascot } from "../components/vectors/BrainMascot";
import { SceneBackdrop } from "../features/landing/hero/SceneBackdrop";
import { Sprout } from "../features/landing/hero/MeadowHero";

// Sign-in failures in plain words. A wrong email or password gets the same
// message (so it never says which one was right).
function signInErrorText(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("invalid") || e.includes("credentials") || e.includes("password")) {
    return "That email and password don't match. Please try again.";
  }
  if (e.includes("confirm")) return "Please confirm your email first. Check your inbox for the link.";
  if (e.includes("network") || e.includes("fetch")) return "We couldn't reach SafeSpace just now. Check your connection and try again.";
  return "Something went wrong signing in. Please try again.";
}

const SUBTITLE = {
  none: "Your calm space is right where you left it.",
  individual: "Sign in to your own calm space.",
  caregiver: "Sign in to support your child.",
};

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const as = chosenRole(useLocation().search);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      const session = await login(email, password);
      // The account's own role wins; say so if they picked the other choice.
      const role = roleOf(session);
      const roleNotice = as && role && role !== as
        ? `You're signed in as ${role === "caregiver" ? "a caregiver" : "an individual"}.`
        : undefined;
      navigate(landingFor(session) ?? "/", roleNotice ? { state: { roleNotice } } : undefined);
    } catch {
      // Error handled via AuthContext state
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative isolate font-sans">
      <SceneBackdrop />
      <Link
        to="/"
        className="absolute left-4 top-4 sm:left-8 sm:top-6 flex items-center gap-2 text-white text-xl sm:text-2xl drop-shadow-[0_2px_8px_rgba(28,70,120,0.45)] [&_svg]:h-7 [&_svg]:w-7"
        style={{ fontFamily: '"Grandstander", "Lexend Deca", sans-serif', fontWeight: 900 }}
      >
        <Sprout />
        SafeSpace
      </Link>

      <div className="w-full max-w-md relative z-10 mt-12 sm:mt-0">
        {/* Mascot Peeking Above Form */}
        <div className="flex justify-center -mb-8 relative z-20">
          <BrainMascot stance="peeking" size={120} />
        </div>

        <Card className="pt-10 pb-8 px-6 sm:px-8 border border-white/70 shadow-2xl relative z-10 !bg-white/80 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl text-textHeading" style={{ fontFamily: '"Grandstander", "Lexend Deca", sans-serif', fontWeight: 900 }}>
              Welcome back
            </h1>
            <p className="text-sm text-textBody mt-1">
              {SUBTITLE[as ?? "none"]}
            </p>
          </div>

          {!as ? (
            <RoleChoice mode="login" />
          ) : (
          <>
          {/* Friendly Error State */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{signInErrorText(error)}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-textHeading">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-olive-700 hover:text-deepGreen font-medium underline underline-offset-2"
                >
                  Forgot password?
                </Link>
              </div>
              <InputField
                isPassword={true}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Log in"}
              </Button>
            </div>
          </form>
          <p className="mt-4 text-center text-xs text-textMuted">
            {as === "caregiver" ? "Not a caregiver?" : "Not signing in for yourself?"}{" "}
            <Link to="/login" className="text-deepGreen font-medium hover:underline">Choose again</Link>
          </p>
          </>
          )}

          <div className="mt-6 pt-4 border-t border-olive-100 text-center text-sm text-textBody">
            New to SafeSpace?{" "}
            <Link to={as ? `/signup?as=${as}` : "/signup"} className="text-deepGreen font-medium hover:underline">
              Create an account
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
