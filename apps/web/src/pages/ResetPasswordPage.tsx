import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../features/auth";
import { SafeSpaceCard } from "../components/ui/SafeSpaceCard";
import { SafeSpaceInput } from "../components/ui/SafeSpaceInput";
import { SafeSpaceButton } from "../components/ui/SafeSpaceButton";
import { SafeSpaceBrandHeader } from "../components/ui/SafeSpaceBrandHeader";
import { MeadowPage } from "../features/landing/hero/MeadowPage";

export const ResetPasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState("");
  const [updated, setUpdated] = useState(false);
  const { t } = useTranslation();
  const { changePassword, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await changePassword(newPassword);
      setUpdated(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch {
      // Error handled via AuthContext
    }
  };

  return (
    <MeadowPage>
      <SafeSpaceCard maxW="md">
        <SafeSpaceBrandHeader
          title={t("auth.reset.title")}
          subtitle={t("auth.reset.subtitle")}
        />

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-coral-50 border border-coral-200 text-coral-800 text-sm">
            {error}
          </div>
        )}

        {updated ? (
          <div className="p-5 bg-botanical-50 border border-botanical-200 rounded-2xl text-botanical-800 text-sm text-center leading-relaxed">
            {t("auth.reset.done")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <SafeSpaceInput
              label={t("auth.reset.newPassword")}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder={t("auth.signup.passwordPlaceholder")}
            />

            <div className="pt-2">
              <SafeSpaceButton
                type="submit"
                disabled={loading}
                className="w-full py-3.5"
              >
                {loading ? t("auth.reset.updating") : t("auth.reset.update")}
              </SafeSpaceButton>
            </div>
          </form>
        )}
      </SafeSpaceCard>
    </MeadowPage>
  );
};

export default ResetPasswordPage;
