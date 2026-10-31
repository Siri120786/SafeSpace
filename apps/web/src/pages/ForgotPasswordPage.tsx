import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../features/auth";
import { SafeSpaceCard } from "../components/ui/SafeSpaceCard";
import { SafeSpaceInput } from "../components/ui/SafeSpaceInput";
import { SafeSpaceButton } from "../components/ui/SafeSpaceButton";
import { SafeSpaceBrandHeader } from "../components/ui/SafeSpaceBrandHeader";
import { MeadowPage } from "../features/landing/hero/MeadowPage";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { t } = useTranslation();
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
          title={t("auth.forgot.title")}
          subtitle={t("auth.forgot.subtitle")}
        />

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-coral-50 border border-coral-200 text-coral-800 text-sm">
            {error}
          </div>
        )}

        {submitted ? (
          <div className="p-5 bg-botanical-50 border border-botanical-200 rounded-2xl text-botanical-800 text-sm mb-6 text-center leading-relaxed">
            {t("auth.forgot.sentBefore")} <strong className="font-semibold">{email}</strong>{t("auth.forgot.sentAfter")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <SafeSpaceInput
              label={t("auth.email")}
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
                {loading ? t("auth.forgot.sending") : t("auth.forgot.send")}
              </SafeSpaceButton>
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-botanical-900/5 text-center text-sm text-charcoal/70">
          {t("auth.forgot.remember")}{" "}
          <Link to="/login" className="text-botanical-700 font-bold hover:underline">
            {t("auth.forgot.backToSignIn")}
          </Link>
        </div>
      </SafeSpaceCard>
    </MeadowPage>
  );
};

export default ForgotPasswordPage;
