import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth";
import { Card } from "../components/ui/Card";
import { InputField } from "../components/ui/InputField";
import { Button } from "../components/ui/Button";
import { BrainMascot } from "../components/vectors/BrainMascot";
import { LeafCluster } from "../components/vectors/LeafFrame";
import { Sparkle } from "../components/vectors/Sparkles";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      // Error handled via AuthContext state
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-cream via-[#FAF7F2] to-paleLime/40 p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Botanical Corner Accents */}
      <LeafCluster position="bottom-left" size={180} className="absolute bottom-0 left-0 opacity-80" />
      <LeafCluster position="top-right" size={180} className="absolute top-0 right-0 opacity-80" />

      {/* Decorative Sparkle */}
      <Sparkle size={24} className="absolute top-12 left-16 text-olive-500" />
      <Sparkle size={20} className="absolute bottom-16 right-16 text-mascotPink" />

      <div className="w-full max-w-md relative z-10">
        {/* Mascot Peeking Above Form */}
        <div className="flex justify-center -mb-8 relative z-20">
          <BrainMascot stance="peeking" size={120} />
        </div>

        <Card className="pt-10 pb-8 px-6 sm:px-8 border border-white shadow-2xl relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
              Welcome back to SafeSpace
            </h1>
            <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
              Your calm, gentle space is waiting for you.
            </p>
          </div>

          {/* Friendly Error State */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>That doesn't look right, try again. ({error})</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              label="Email Address"
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

          <div className="mt-6 pt-4 border-t border-olive-100 text-center text-xs text-textMuted font-light">
            New to SafeSpace?{" "}
            <Link to="/signup" className="text-deepGreen font-medium hover:underline">
              Create an account
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
