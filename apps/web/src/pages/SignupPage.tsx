import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth";
import type { UserRole } from "@safespace/shared-types";
import { Card } from "../components/ui/Card";
import { InputField } from "../components/ui/InputField";
import { Button } from "../components/ui/Button";
import { BrainMascot } from "../components/vectors/BrainMascot";
import { LeafCluster } from "../components/vectors/LeafFrame";
import { Sparkle } from "../components/vectors/Sparkles";

export const SignupPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const { signup, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-cream via-[#FAF7F2] to-paleLime/40 p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Botanical Corner Accents */}
      <LeafCluster position="bottom-left" size={180} className="absolute bottom-0 left-0 opacity-80" />
      <LeafCluster position="top-right" size={180} className="absolute top-0 right-0 opacity-80" />

      {/* Decorative Sparkles */}
      <Sparkle size={24} className="absolute top-12 right-16 text-olive-500" />
      <Sparkle size={20} className="absolute bottom-16 left-16 text-mascotPink" />

      <div className="w-full max-w-md relative z-10">
        {/* Waving Mascot Peeking Above Form */}
        <div className="flex justify-center -mb-8 relative z-20">
          <BrainMascot stance="waving" size={130} />
        </div>

        <Card className="pt-10 pb-8 px-6 sm:px-8 border border-white shadow-2xl relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
              Begin your journey
            </h1>
            <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
              Create your private, supportive SafeSpace profile.
            </p>
          </div>

          {/* Error Banner */}
          {(error || termsError) && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{termsError ? "Please agree to the Terms & Privacy policy." : error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Role Selector */}
            <div>
              <label className="block text-xs font-semibold text-textHeading mb-1.5">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-olive-50/60 rounded-2xl border border-olive-100">
                <button
                  type="button"
                  onClick={() => setRole("user")}
                  className={`py-2 px-3 text-xs font-medium rounded-xl transition-all ${
                    role === "user"
                      ? "bg-white text-deepGreen shadow-sm font-semibold"
                      : "text-textMuted hover:text-textHeading"
                  }`}
                >
                  Individual User
                </button>
                <button
                  type="button"
                  onClick={() => setRole("caregiver")}
                  className={`py-2 px-3 text-xs font-medium rounded-xl transition-all ${
                    role === "caregiver"
                      ? "bg-white text-deepGreen shadow-sm font-semibold"
                      : "text-textMuted hover:text-textHeading"
                  }`}
                >
                  Caregiver Lead
                </button>
              </div>
            </div>

            <InputField
              label="Your Name / Nickname"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Emma"
              required
            />

            <InputField
              label="Email Address"
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
              placeholder="Minimum 6 characters"
            />

            {/* Terms & Privacy Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5 rounded-lg border-olive-300 text-deepGreen focus:ring-olive-500 w-4 h-4"
              />
              <label htmlFor="terms" className="text-xs text-textMuted font-light cursor-pointer select-none">
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

          <div className="mt-6 pt-4 border-t border-olive-100 text-center text-xs text-textMuted font-light">
            Already have an account?{" "}
            <Link to="/login" className="text-deepGreen font-medium hover:underline">
              Log in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
