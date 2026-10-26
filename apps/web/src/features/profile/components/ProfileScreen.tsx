import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { landingFor, useAuth } from "../../auth";
import type { ModuleKey } from "@safespace/shared-types";
import {
  getSupportPreferences,
  getAccessibilityPreferences,
  saveSupportPreferences,
  saveAccessibilityPreferences,
  updateUserProfile,
} from "@safespace/api-client";
import { Card } from "../../../components/ui/Card";
import { InputField } from "../../../components/ui/InputField";
import { Button } from "../../../components/ui/Button";
import { BrainMascot } from "../../../components/vectors/BrainMascot";
import { useAccessibility } from "../context/AccessibilityContext";
import { forgetSupportAreas } from "../../themes/useAppTheme";
import { MeadowNote, MeadowPage } from "../../landing/hero/MeadowPage";

const SUPPORT_AREA_OPTIONS: { key: ModuleKey; label: string; desc: string; icon: string }[] = [
  { key: "anxiety", label: "Anxiety Support", desc: "Breathing, grounding & gentle reframing", icon: "🌱" },
  { key: "adhd", label: "ADHD Support", desc: "Micro-tasking, structure & focus timers", icon: "⚡" },
  { key: "autism", label: "Autism Support", desc: "Sensory ease, predictability & clarity", icon: "🧩" },
  { key: "depression", label: "Depression Support", desc: "Low-energy steps & gentle encouragement", icon: "🌤️" },
  { key: "ptsd", label: "PTSD Support", desc: "Grounding exercises & comforting routines", icon: "🛡️" },
  { key: "pcos_pcod", label: "PCOS / PCOD Wellbeing", desc: "Hormonal balance, rest & self-care", icon: "🌸" },
];

export const ProfileScreen: React.FC = () => {
  const { session, refreshSession } = useAuth();
  const navigate = useNavigate();
  const { setPreferences, speakText } = useAccessibility();

  const [displayName, setDisplayName] = useState<string>("");
  const [supportAreas, setSupportAreas] = useState<ModuleKey[]>([]);
  const [accessibility, setAccessibilityState] = useState({
    reducedSensoryStimulation: false,
    largerText: false,
    readAloud: false,
    simplifiedPresentation: false,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const profile = session?.kind === "auth_user" ? session.profile : null;
  const profileId = profile?.id;

  const loadData = useCallback(async () => {
    if (!profileId) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (profile.displayName) {
        setDisplayName(profile.displayName);
      }

      const [supp, acc] = await Promise.all([
        getSupportPreferences(profileId).catch(() => null),
        getAccessibilityPreferences(profileId).catch(() => null),
      ]);

      if (supp?.supportAreas) {
        setSupportAreas(supp.supportAreas);
      }

      if (acc) {
        const accState = {
          reducedSensoryStimulation: !!acc.reducedSensoryStimulation,
          largerText: !!acc.largerText,
          readAloud: !!acc.readAloud,
          simplifiedPresentation: !!acc.simplifiedPresentation,
        };
        setAccessibilityState(accState);
        setPreferences({
          profileId,
          ...accState,
          createdAt: acc.createdAt || "",
          updatedAt: acc.updatedAt || "",
        });
      }
    } catch (err: unknown) {
      console.error("Failed to load profile details:", err);
      setErrorMsg("Failed to load profile preferences. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [profileId, profile?.displayName, setPreferences]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!session || session.kind !== "auth_user" || !profileId) {
    return (
      <div className="p-8 text-center text-textMuted">
        Please sign in to view your profile.
      </div>
    );
  }

  const handleToggleSupportArea = (key: ModuleKey) => {
    setSupportAreas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleAccessibility = (key: keyof typeof accessibility) => {
    setAccessibilityState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    if (!displayName.trim()) {
      setErrorMsg("Display name is required.");
      return;
    }

    setIsSaving(true);

    try {
      // 1. Update Display Name
      await updateUserProfile(profileId, { displayName: displayName.trim() });

      // 2. Save Support Preferences
      forgetSupportAreas();
        await saveSupportPreferences({
        profileId,
        supportAreas,
      });

      // 3. Save Accessibility Preferences
      const savedAcc = await saveAccessibilityPreferences({
        profileId,
        ...accessibility,
      });

      setPreferences(savedAcc);
      await refreshSession();

      setSuccessMsg("Profile and preferences saved successfully!");
      speakText("Profile saved successfully.");
    } catch (err: unknown) {
      console.error("Error saving profile:", err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to save profile changes. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <MeadowPage>
        <MeadowNote>Loading your profile...</MeadowNote>
      </MeadowPage>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 font-sans">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            type="button"
            onClick={() => navigate(landingFor(session) ?? "/")}
            className="text-xs font-semibold text-deepGreen hover:underline mb-2 flex items-center gap-1"
          >
            &larr; Back to home
          </button>
          <h1 className="font-display text-3xl font-medium text-textHeading">
            Profile &amp; Preferences
          </h1>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
            Manage your personal profile, support selections, and sensory accessibility.
          </p>
        </div>
        <BrainMascot stance="happy" size={80} />
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-lg">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-lg">&times;</button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info Card */}
        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl font-medium text-textHeading border-b pb-2">
            User Identity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Display Name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              required
            />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-textMuted mb-2">
                Account Role
              </label>
              <div className="p-3 bg-olive-50 rounded-xl border border-olive-200 text-sm font-medium text-textHeading capitalize">
                {profile.role} Account
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-textMuted mb-1">
              Onboarding Status
            </label>
            <span
              className={`inline-block text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                profile.onboardingState === "completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {profile.onboardingState}
            </span>
          </div>
        </Card>

        {/* Support Preferences Card */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-display text-xl font-medium text-textHeading border-b pb-2">
              Support Preferences
            </h2>
            <p className="text-xs text-textMuted mt-1">
              Select support areas you would like SafeSpace to adapt around. SafeSpace provides assistance tools — these selections are support preferences, not diagnoses.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUPPORT_AREA_OPTIONS.map((area) => {
              const isSelected = supportAreas.includes(area.key);
              return (
                <button
                  key={area.key}
                  type="button"
                  onClick={() => handleToggleSupportArea(area.key)}
                  className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all text-left ${
                    isSelected
                      ? "bg-olive-50/80 border-olive-500 ring-2 ring-olive-500/50 shadow-sm"
                      : "bg-white border-olive-100 hover:border-olive-300"
                  }`}
                >
                  <span className="text-xl shrink-0">{area.icon}</span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-textHeading">{area.label}</h3>
                    <p className="text-[11px] text-textMuted font-light mt-0.5 leading-snug">
                      {area.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Accessibility Preferences Card */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-display text-xl font-medium text-textHeading border-b pb-2">
              Accessibility &amp; Visual Comfort
            </h2>
            <p className="text-xs text-textMuted mt-1">
              Configure sensory preferences and legibility parameters.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                key: "reducedSensoryStimulation",
                label: "Reduced Sensory Stimulation",
                desc: "Softened visual palette and reduced movement.",
              },
              {
                key: "largerText",
                label: "Larger Text & High Contrast",
                desc: "Increases default typography sizes across screens.",
              },
              {
                key: "readAloud",
                label: "Read-Aloud & Spoken Assistance",
                desc: "Enables audio spoken prompts and audio feedback.",
              },
              {
                key: "simplifiedPresentation",
                label: "Simplified Presentation",
                desc: "Displays clean, focused interface layouts.",
              },
            ].map((opt) => {
              const k = opt.key as keyof typeof accessibility;
              const isChecked = accessibility[k];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleToggleAccessibility(k)}
                  className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all text-left ${
                    isChecked
                      ? "bg-olive-50 border-olive-500 font-semibold"
                      : "bg-white border-olive-100"
                  }`}
                >
                  <div>
                    <h3 className="text-xs sm:text-sm text-textHeading">{opt.label}</h3>
                    <p className="text-[11px] text-textMuted font-light">{opt.desc}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs ${
                      isChecked
                        ? "bg-deepGreen text-white border-deepGreen"
                        : "border-olive-300"
                    }`}
                  >
                    {isChecked && "✓"}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Save Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(landingFor(session) ?? "/")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Profile & Preferences"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProfileScreen;
