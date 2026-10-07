import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth";
import { SafeSpaceCard } from "../components/ui/SafeSpaceCard";
import { SafeSpaceInput } from "../components/ui/SafeSpaceInput";
import { SafeSpaceButton } from "../components/ui/SafeSpaceButton";
import { SafeSpaceBrandHeader } from "../components/ui/SafeSpaceBrandHeader";

export const ResetPasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState("");
  const [updated, setUpdated] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4 sm:p-6">
      <SafeSpaceCard maxW="md">
        <SafeSpaceBrandHeader
          title="Set New Password"
          subtitle="Enter your new secure password below"
        />

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-coral-50 border border-coral-200 text-coral-800 text-sm">
            {error}
          </div>
        )}

        {updated ? (
          <div className="p-5 bg-botanical-50 border border-botanical-200 rounded-2xl text-botanical-800 text-sm text-center leading-relaxed">
            Password updated successfully! Redirecting to sign in...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <SafeSpaceInput
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Minimum 6 characters"
            />

            <div className="pt-2">
              <SafeSpaceButton
                type="submit"
                disabled={loading}
                className="w-full py-3.5"
              >
                {loading ? "Updating..." : "Update Password"}
              </SafeSpaceButton>
            </div>
          </form>
        )}
      </SafeSpaceCard>
    </div>
  );
};

export default ResetPasswordPage;
