import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth";
import { SafeSpaceCard } from "../components/ui/SafeSpaceCard";
import { SafeSpaceInput } from "../components/ui/SafeSpaceInput";
import { SafeSpaceButton } from "../components/ui/SafeSpaceButton";
import { SafeSpaceBrandHeader } from "../components/ui/SafeSpaceBrandHeader";
import { MeadowPage } from "../features/landing/hero/MeadowPage";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { resetPassword, loading, error, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch {
      // Error handled via AuthContext
    }
  };

  return (
    <MeadowPage>
      <SafeSpaceCard maxW="md">
        <SafeSpaceBrandHeader
          title="Reset Password"
          subtitle="Enter your registered email address to receive reset instructions"
        />

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-coral-50 border border-coral-200 text-coral-800 text-sm">
            {error}
          </div>
        )}

        {submitted ? (
          <div className="p-5 bg-botanical-50 border border-botanical-200 rounded-2xl text-botanical-800 text-sm mb-6 text-center leading-relaxed">
            If an account exists for <strong className="font-semibold">{email}</strong>, a password reset link has been sent to your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <SafeSpaceInput
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />

            <div className="pt-2">
              <SafeSpaceButton
                type="submit"
                disabled={loading}
                className="w-full py-3.5"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </SafeSpaceButton>
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-botanical-900/5 text-center text-sm text-charcoal/70">
          Remember your password?{" "}
          <Link to="/login" className="text-botanical-700 font-bold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </SafeSpaceCard>
    </MeadowPage>
  );
};

export default ForgotPasswordPage;
