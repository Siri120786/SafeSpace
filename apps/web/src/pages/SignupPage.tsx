import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { chosenRole, RoleChoice, useAuth } from "../features/auth";
import type { UserRole } from "@safespace/shared-types";
import { Card } from "../components/ui/Card";
import { InputField } from "../components/ui/InputField";
import { Button } from "../components/ui/Button";
import { BrainMascot } from "../components/vectors/BrainMascot";
import { SceneBackdrop } from "../features/landing/hero/SceneBackdrop";
import { Sprout } from "../features/landing/hero/MeadowHero";

const DISPLAY = { fontFamily: '"Grandstander", "Lexend Deca", sans-serif', fontWeight: 900 } as const;

// Sign-up failures in plain words.
function signUpErrorText(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("already") || e.includes("exists") || e.includes("registered")) {
    return "That email already has an account. Try logging in instead.";
  }
  if (e.includes("password")) return "Please choose a password of at least 6 characters.";
  if (e.includes("network") || e.includes("fetch")) return "We couldn't reach SafeSpace just now. Check your connection and try again.";
  if (e.includes("email")) return "Please check the email address.";
  return "Something went wrong creating your space. Please try again.";
}

const HEADINGS = {
  none: { title: "Make your SafeSpace", text: "Your own private, gentle space. It only takes a minute." },
  individual: { title: "Make your own space", text: "Just for you: moods, routines, calm tools and more." },
  caregiver: { title: "Set up as a caregiver", text: "Then add your child and make their space together." },
};

export const SignupPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const { signup, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const as = chosenRole(useLocation().search);
  const role: UserRole = as === "caregiver" ? "caregiver" : "user";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAgreed) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    clearError();
    try {
      await signup(email, password, role, displayName);
      navigate("/onboarding");
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
        style={DISPLAY}
      >
        <Sprout />
        SafeSpace
      </Link>

      <div className="w-full max-w-md relative z-10 mt-12 sm:mt-0">
        {/* Waving Mascot Peeking Above Form */}
        <div className="flex justify-center -mb-8 relative z-20">
          <BrainMascot stance="waving" size={130} />
        </div>

        <Card className="pt-10 pb-8 px-6 sm:px-8 border border-white/70 shadow-2xl relative z-10 !bg-white/80 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl text-textHeading" style={DISPLAY}>
              {HEADINGS[as ?? "none"].title}
            </h1>
            <p className="text-sm text-textBody mt-1">
              {HEADINGS[as ?? "none"].text}
            </p>
          </div>

          {!as ? (
            <RoleChoice mode="signup" />
          ) : (
          <>
          {/* Error Banner */}
          {(error || termsError) && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{termsError ? "Please agree to the Terms of Service and Privacy Policy to continue." : signUpErrorText(error ?? "")}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* The account type was chosen on the previous screen. */}
            <div className="flex items-center justify-between rounded-2xl border border-olive-100 bg-olive-50/60 px-4 py-2.5 text-xs">
              <span className="text-textHeading">
                This account is for: <strong>{role === "caregiver" ? "a caregiver" : "just me"}</strong>
              </span>
              <Link to="/signup" className="text-deepGreen font-medium underline">Change</Link>
            </div>

            <InputField
              label="Your name or nickname"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Emma"
              required
            />

            <InputField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />

            <InputField
              label="Password"
              isPassword={true}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="At least 6 characters"
            />

            {/* Terms & Privacy Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 p-0 rounded border-olive-300 accent-[#5b875c] focus:ring-olive-500"
              />
              <label htmlFor="terms" className="mt-0 text-sm text-textBody cursor-pointer select-none">
                I agree to the SafeSpace{" "}
                <span className="text-deepGreen font-medium underline">Terms of Service</span> and{" "}
                <span className="text-deepGreen font-medium underline">Privacy Policy</span>.
              </label>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                disabled={loading}
              >
                {loading ? "Creating your space..." : "Create my space"}
              </Button>
            </div>
          </form>
          </>
          )}

          <div className="mt-6 pt-4 border-t border-olive-100 text-center text-sm text-textBody">
            Already have an account?{" "}
            <Link to={as ? `/login?as=${as}` : "/login"} className="text-deepGreen font-medium hover:underline">
              Log in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
