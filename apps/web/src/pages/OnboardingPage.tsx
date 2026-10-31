import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { homeFor, useAuth } from "../features/auth";
import { JoinInviteForm } from "../features/caregiver";
import type { ModuleKey, UserRole } from "@safespace/shared-types";
import {
  getSupportPreferences,
  getAccessibilityPreferences,
  saveSupportPreferences,
  saveAccessibilityPreferences,
  completeOnboarding,
  updateUserProfile,
  addChild,
  isValidChildBirth,
} from "@safespace/api-client";
import { Card } from "../components/ui/Card";
import { InputField } from "../components/ui/InputField";
import { Button } from "../components/ui/Button";
import { BrainMascot } from "../components/vectors/BrainMascot";
import { SceneBackdrop } from "../features/landing/hero/SceneBackdrop";
import { forgetSupportAreas } from "../features/themes/useAppTheme";
import { LanguageSwitch } from "../components/ui/LanguageSwitch";

// Labels and descriptions: onboarding.areas.<key> in the locale files.
const SUPPORT_AREA_OPTIONS: { key: ModuleKey; icon: string }[] = [
  { key: "anxiety", icon: "🌱" },
  { key: "adhd", icon: "⚡" },
  { key: "autism", icon: "🧩" },
  { key: "depression", icon: "🌤️" },
  { key: "ptsd", icon: "🛡️" },
  { key: "pcos_pcod", icon: "🌸" },
];

// Month names in the app's language (1 = January).
const monthName = (month: number, lang: string) =>
  new Date(2000, month - 1, 1).toLocaleDateString(lang, { month: "long" });

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null) {
    const obj = err as { message?: string };
    if (obj.message) return obj.message;
  }
  return fallback;
}

export const OnboardingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { session, refreshSession } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [displayName, setDisplayName] = useState<string>("");

  // Individual User State
  const [userSupportAreas, setUserSupportAreas] = useState<ModuleKey[]>([]);
  const [accessibility, setAccessibility] = useState({
    reducedSensoryStimulation: false,
    largerText: false,
    readAloud: false,
    simplifiedPresentation: false,
  });

  // Caregiver Child Setup State
  const [childName, setChildName] = useState<string>("");
  const [childBirthMonth, setChildBirthMonth] = useState<number | "">("");
  const [childBirthYear, setChildBirthYear] = useState<number | "">("");
  const [childPin, setChildPin] = useState<string>("");
  const [childModules, setChildModules] = useState<ModuleKey[]>([]);
  // Step 2 for caregivers: add a first child, join one with an invite, or skip.
  const [childSetup, setChildSetup] = useState<"choose" | "add" | "join" | "joined" | "skipped">("choose");

  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const profileId = session?.kind === "auth_user" ? session.profile.id : null;
  const role: UserRole = session?.kind === "auth_user" ? session.profile.role : "user";
  const isCaregiver = role === "caregiver";

  const loadPreferences = useCallback(async (targetProfileId: string) => {
    setIsLoadingExisting(true);
    setErrorMsg(null);

    try {
      if (session?.kind === "auth_user" && session.profile.displayName) {
        setDisplayName(session.profile.displayName);
      }

      // Restore saved onboarding step from storage if present
      const savedStep = localStorage.getItem(`safespace_onboarding_step_${targetProfileId}`);
      if (savedStep) {
        const stepNum = parseInt(savedStep, 10);
        if (stepNum >= 1 && stepNum <= 4) {
          // Child details aren't saved between visits, so caregivers resume at the choice.
          setCurrentStep(isCaregiver ? Math.min(stepNum, 2) : stepNum);
        }
      }

      if (!isCaregiver) {
        const [supportRes, accessRes] = await Promise.all([
          getSupportPreferences(targetProfileId).catch((err) => {
            console.warn("Could not load support preferences:", err);
            return null;
          }),
          getAccessibilityPreferences(targetProfileId).catch((err) => {
            console.warn("Could not load accessibility preferences:", err);
            return null;
          }),
        ]);

        if (supportRes?.supportAreas && Array.isArray(supportRes.supportAreas)) {
          setUserSupportAreas(supportRes.supportAreas);
        }

        if (accessRes) {
          setAccessibility({
            reducedSensoryStimulation: !!accessRes.reducedSensoryStimulation,
            largerText: !!accessRes.largerText,
            readAloud: !!accessRes.readAloud,
            simplifiedPresentation: !!accessRes.simplifiedPresentation,
          });
        }
      }
    } catch (err: unknown) {
      console.error("Initialization error in onboarding:", err);
    } finally {
      setIsLoadingExisting(false);
    }
  }, [session, isCaregiver]);

  useEffect(() => {
    if (!profileId) return;
    loadPreferences(profileId);
  }, [profileId, loadPreferences]);

  if (!session || session.kind !== "auth_user" || !profileId) {
    return null;
  }

  const updateStep = (nextStep: number) => {
    setCurrentStep(nextStep);
    if (profileId) {
      localStorage.setItem(`safespace_onboarding_step_${profileId}`, nextStep.toString());
    }
  };

  const handleToggleUserSupportArea = (key: ModuleKey) => {
    setUserSupportAreas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleChildModule = (key: ModuleKey) => {
    setChildModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleNext = async () => {
    setErrorMsg(null);

    // Validation for Step 1
    if (currentStep === 1 && !displayName.trim()) {
      setErrorMsg(t("onboarding.errorName"));
      return;
    }

    // Save intermediate progress on steps
    try {
      if (currentStep === 1 && displayName.trim() && displayName.trim() !== session.profile.displayName) {
        await updateUserProfile(profileId, { displayName: displayName.trim() });
      } else if (currentStep === 2 && !isCaregiver) {
        forgetSupportAreas();
        await saveSupportPreferences({ profileId, supportAreas: userSupportAreas }).catch(() => null);
      } else if (currentStep === 3 && !isCaregiver) {
        await saveAccessibilityPreferences({ profileId, ...accessibility }).catch(() => null);
      }
    } catch (e) {
      console.warn("Intermediate save warning:", e);
    }

    if (isCaregiver && currentStep === 2) {
      if (!childName.trim()) {
        setErrorMsg(t("onboarding.errorChildName"));
        return;
      }
      if (!isValidChildBirth(childBirthYear, childBirthMonth) || !/^\d{4}$/.test(childPin)) {
        setErrorMsg(t("onboarding.errorChildDetails"));
        return;
      }
    }

    if (currentStep < 4) {
      updateStep(currentStep + 1);
    } else {
      handleCompleteOnboarding();
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (isCaregiver && currentStep === 2 && childSetup !== "choose") {
      setChildSetup("choose");
    } else if (isCaregiver && currentStep === 4 && childSetup !== "add") {
      // Joined or skipped: there was no modules step.
      if (childSetup === "skipped") setChildSetup("choose");
      updateStep(2);
    } else if (currentStep > 1) {
      updateStep(currentStep - 1);
    }
  };

  // skipChild: the header "Skip" finishes without adding a child.
  const handleCompleteOnboarding = async (skipChild = false) => {
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // 1. Update adult display name
      if (displayName.trim() && displayName.trim() !== session.profile.displayName) {
        await updateUserProfile(profileId, { displayName: displayName.trim() });
      }

      if (isCaregiver) {
        // CAREGIVER FLOW: Create child if child details provided.
        // NEVER save child modules to caregiver's adult profile_support_preferences!
        if (!skipChild && childSetup === "add" && childName.trim()) {
          if (!isValidChildBirth(childBirthYear, childBirthMonth) || !/^\d{4}$/.test(childPin)) {
            throw new Error(t("onboarding.errorChildDetails"));
          }
          await addChild({
            name: childName.trim(),
            birthYear: childBirthYear as number,
            birthMonth: childBirthMonth as number,
            pin: childPin,
            modules: childModules,
          });
        }
      } else {
        // INDIVIDUAL USER FLOW: Save adult support & accessibility preferences
        forgetSupportAreas();
        await saveSupportPreferences({
          profileId,
          supportAreas: userSupportAreas,
        });

        await saveAccessibilityPreferences({
          profileId,
          ...accessibility,
        });
      }

      // Mark onboarding completed for authenticated adult profile
      await completeOnboarding(profileId);
      if (profileId) {
        localStorage.removeItem(`safespace_onboarding_step_${profileId}`);
      }
      await refreshSession();
      navigate(homeFor(isCaregiver ? "caregiver" : "individual"), { replace: true });
    } catch (err: unknown) {
      console.error("Failed to complete onboarding:", err);
      setErrorMsg(extractErrorMessage(err, t("onboarding.errorSetup")));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-10 px-4 sm:px-6 font-sans relative isolate">
      {/* The landing page's meadow, softly blurred behind the steps */}
      <SceneBackdrop />

      {/* Onboarding Container */}
      <div className="w-full max-w-lg relative z-10">
        <div className="mb-3 flex justify-center">
          <LanguageSwitch look="glass" />
        </div>
        
        {/* Header Navigation Bar */}
        <div className="flex items-center justify-between mb-6 rounded-full bg-white/85 backdrop-blur-xl border border-white/70 px-4 py-2.5 shadow-[0_8px_20px_rgba(20,60,100,0.18)]">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-sm font-medium text-textBody hover:text-deepGreen transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>{t("common.back")}</span>
            </button>
          ) : (
            <div className="w-12" />
          )}

          {/* 4 Progress Dots */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  currentStep === stepNum
                    ? "w-8 bg-deepGreen"
                    : currentStep > stepNum
                    ? "w-2.5 bg-olive-500"
                    : "w-2.5 bg-olive-200"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleCompleteOnboarding(true)}
            className="text-xs font-medium text-textMuted hover:text-textHeading transition-colors underline"
          >
            {t("onboarding.skip")}
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} aria-label={t("common.close")} className="font-bold text-base ml-2">&times;</button>
          </div>
        )}

        {/* =========================================================================
            FLOW A: INDIVIDUAL USER ONBOARDING (profile.role === 'user')
           ========================================================================= */}
        {!isCaregiver && (
          <>
            {/* USER STEP 1: Name */}
            {currentStep === 1 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div className="flex justify-center">
                  <BrainMascot stance="waving" size={150} showBubble={true} bubbleText={t("onboarding.user.bubble1")} />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
                    {t("onboarding.user.nameTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.user.nameText")}
                  </p>
                </div>
                <div className="text-left">
                  <InputField
                    label={t("onboarding.user.nameLabel")}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("onboarding.user.namePlaceholder")}
                    autoFocus
                  />
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  {t("common.continue")}
                </Button>
              </Card>
            )}

            {/* USER STEP 2: Support Preferences */}
            {currentStep === 2 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    {t("onboarding.step", { n: 2, total: 4 })}
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    {t("onboarding.user.areasTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.user.areasText")}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-h-72 overflow-y-auto pr-1">
                  {SUPPORT_AREA_OPTIONS.map((area) => {
                    const isSelected = userSupportAreas.includes(area.key);
                    return (
                      <button
                        key={area.key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleToggleUserSupportArea(area.key)}
                        className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all text-left ${
                          isSelected
                            ? "bg-olive-50/80 border-olive-500 ring-2 ring-olive-500/50 shadow-sm"
                            : "bg-white border-olive-100 hover:border-olive-300"
                        }`}
                      >
                        <span className="text-xl shrink-0">{area.icon}</span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-medium text-textHeading">{t(`onboarding.areas.${area.key}.label`)}</h4>
                          <p className="text-[11px] text-textMuted font-light mt-0.5 leading-snug">
                            {t(`onboarding.areas.${area.key}.desc`)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  {t("common.continue")}
                </Button>
              </Card>
            )}

            {/* USER STEP 3: Accessibility Preferences */}
            {currentStep === 3 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    {t("onboarding.step", { n: 3, total: 4 })}
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    {t("onboarding.user.comfortTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.user.comfortText")}
                  </p>
                </div>
                <div className="space-y-3 text-left">
                  {(["reducedSensoryStimulation", "largerText", "readAloud", "simplifiedPresentation"] as const).map((key) => ({
                    key,
                    label: t(`onboarding.access.${key}.label`),
                    desc: t(`onboarding.access.${key}.desc`),
                  })).map((opt) => {
                    const k = opt.key as keyof typeof accessibility;
                    const isChecked = accessibility[k];
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={isChecked}
                        onClick={() => setAccessibility((prev) => ({ ...prev, [k]: !prev[k] }))}
                        className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                          isChecked ? "bg-olive-50 border-olive-500 font-semibold" : "bg-white border-olive-100"
                        }`}
                      >
                        <div>
                          <h4 className="text-xs sm:text-sm text-textHeading">{opt.label}</h4>
                          <p className="text-[11px] text-textMuted font-light">{opt.desc}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs ${isChecked ? "bg-deepGreen text-white border-deepGreen" : "border-olive-300"}`}>
                          {isChecked && "✓"}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  {t("common.continue")}
                </Button>
              </Card>
            )}

            {/* USER STEP 4: Review & Complete */}
            {currentStep === 4 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div className="flex justify-center">
                  <BrainMascot stance="celebrating" size={150} showBubble={true} bubbleText={t("onboarding.user.bubble4")} />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
                    {t("onboarding.user.doneTitle", { name: displayName || t("onboarding.user.friend") })} 🎉
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.user.doneText")}
                  </p>
                </div>
                <div className="bg-olive-50/60 p-4 rounded-2xl border border-olive-100 text-left space-y-2 text-xs text-textBody">
                  <p><strong>{t("onboarding.summary.name")}</strong> {displayName}</p>
                  <p><strong>{t("onboarding.summary.areas")}</strong> {t("onboarding.summary.selected", { count: userSupportAreas.length })}</p>
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={() => handleCompleteOnboarding()} disabled={isSubmitting}>
                  {isSubmitting ? t("onboarding.user.settingUp") : t("onboarding.user.enter")}
                </Button>
              </Card>
            )}
          </>
        )}

        {/* =========================================================================
            FLOW B: CAREGIVER ONBOARDING (profile.role === 'caregiver')
           ========================================================================= */}
        {isCaregiver && (
          <>
            {/* CAREGIVER STEP 1: Caregiver Basic Info */}
            {currentStep === 1 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div className="flex justify-center">
                  <BrainMascot stance="happy" size={150} showBubble={true} bubbleText={t("onboarding.cg.bubble1")} />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
                    {t("onboarding.cg.nameTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.cg.nameText")}
                  </p>
                </div>
                <div className="text-left">
                  <InputField
                    label={t("onboarding.cg.nameLabel")}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("onboarding.cg.namePlaceholder")}
                    autoFocus
                  />
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  {t("common.continue")}
                </Button>
              </Card>
            )}

            {/* CAREGIVER STEP 2a: Add a child, join with an invite, or skip */}
            {currentStep === 2 && childSetup === "choose" && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    {t("onboarding.step", { n: 2, total: 4 })}
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    {t("onboarding.cg.whoTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.cg.whoText")}
                  </p>
                </div>
                <div className="space-y-3 text-left">
                  {[
                    { key: "add" as const, title: t("onboarding.cg.addTitle"), text: t("onboarding.cg.addText"), icon: "🧒" },
                    { key: "join" as const, title: t("onboarding.cg.joinTitle"), text: t("onboarding.cg.joinText"), icon: "🔑" },
                  ].map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => { setErrorMsg(null); setChildSetup(o.key); }}
                      className="w-full flex items-center gap-4 rounded-2xl border border-olive-100 bg-white px-4 py-4 text-left transition-colors hover:bg-olive-50"
                    >
                      <span aria-hidden="true" className="text-2xl">{o.icon}</span>
                      <span className="flex-1">
                        <span className="block font-display text-base font-medium text-textHeading">{o.title}</span>
                        <span className="block text-xs text-textMuted font-light">{o.text}</span>
                      </span>
                      <span aria-hidden="true" className="text-deepGreen font-semibold">&rarr;</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setChildSetup("skipped"); updateStep(4); }}
                  className="text-xs font-medium text-textMuted hover:text-textHeading underline"
                >
                  {t("onboarding.cg.skipChild")}
                </button>
              </Card>
            )}

            {/* CAREGIVER STEP 2b: Join with an invite code */}
            {currentStep === 2 && childSetup === "join" && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    {t("onboarding.step", { n: 2, total: 4 })}
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    {t("onboarding.cg.joinTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.cg.joinCodeText")}
                  </p>
                </div>
                <JoinInviteForm onJoined={() => { setChildSetup("joined"); updateStep(4); }} />
              </Card>
            )}

            {/* CAREGIVER STEP 2c: Child Setup */}
            {currentStep === 2 && childSetup === "add" && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    {t("onboarding.step", { n: 2, total: 4 })}
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    {t("onboarding.cg.childTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.cg.childText")}
                  </p>
                </div>
                <div className="text-left space-y-4">
                  <InputField
                    label={t("onboarding.cg.childName")}
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder={t("onboarding.cg.childNamePlaceholder")}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-textHeading">
                      {t("onboarding.cg.birthMonth")}
                      <select
                        value={childBirthMonth}
                        onChange={(e) => setChildBirthMonth(e.target.value ? Number(e.target.value) : "")}
                        className="rounded-2xl border border-olive-200 bg-white px-4 py-3 text-sm font-normal"
                      >
                        <option value="">{t("onboarding.cg.month")}</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>{monthName(m, i18n.language)}</option>
                        ))}
                      </select>
                    </label>
                    <InputField
                      label={t("onboarding.cg.birthYear")}
                      type="number"
                      value={childBirthYear}
                      onChange={(e) => setChildBirthYear(e.target.value ? Number(e.target.value) : "")}
                      placeholder={t("onboarding.cg.birthYearPlaceholder")}
                    />
                  </div>
                  <InputField
                    label={t("onboarding.cg.pin")}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={childPin}
                    onChange={(e) => setChildPin(e.target.value.replace(/\D/g, ""))}
                    placeholder={t("onboarding.cg.pinPlaceholder")}
                    helperText={t("onboarding.cg.pinHelp")}
                  />
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  {t("common.continue")}
                </Button>
              </Card>
            )}

            {/* CAREGIVER STEP 3: Child Support Modules */}
            {currentStep === 3 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    {t("onboarding.step", { n: 3, total: 4 })}
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    {t("onboarding.cg.areasTitle", { name: childName || t("onboarding.cg.yourChild") })}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.cg.areasText", { name: childName || t("onboarding.cg.yourChild") })}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-h-72 overflow-y-auto pr-1">
                  {SUPPORT_AREA_OPTIONS.map((area) => {
                    const isSelected = childModules.includes(area.key);
                    return (
                      <button
                        key={area.key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleToggleChildModule(area.key)}
                        className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all text-left ${
                          isSelected
                            ? "bg-olive-50/80 border-olive-500 ring-2 ring-olive-500/50 shadow-sm"
                            : "bg-white border-olive-100 hover:border-olive-300"
                        }`}
                      >
                        <span className="text-xl shrink-0">{area.icon}</span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-medium text-textHeading">{t(`onboarding.areas.${area.key}.label`)}</h4>
                          <p className="text-[11px] text-textMuted font-light mt-0.5 leading-snug">
                            {t(`onboarding.areas.${area.key}.desc`)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  {t("common.continue")}
                </Button>
              </Card>
            )}

            {/* CAREGIVER STEP 4: Review & Complete */}
            {currentStep === 4 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div className="flex justify-center">
                  <BrainMascot stance="celebrating" size={150} showBubble={true} bubbleText={t("onboarding.cg.bubble4")} />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
                    {t("onboarding.cg.doneTitle", { name: displayName || t("onboarding.cg.caregiver") })} 🎉
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    {t("onboarding.cg.doneText")}
                  </p>
                </div>
                <div className="bg-olive-50/60 p-4 rounded-2xl border border-olive-100 text-left space-y-2 text-xs text-textBody">
                  <p><strong>{t("onboarding.summary.caregiver")}</strong> {displayName}</p>
                  {childSetup === "joined" && <p><strong>{t("onboarding.summary.joined")}</strong> {t("onboarding.summary.joinedText")}</p>}
                  {childSetup === "skipped" && <p>{t("onboarding.summary.skippedText")}</p>}
                  {childSetup === "add" && childName && (
                    <>
                      <p>
                        <strong>{t("onboarding.summary.child")}</strong> {childName}
                        {childBirthMonth && childBirthYear
                          ? ` ${t("onboarding.summary.born", { month: monthName(childBirthMonth as number, i18n.language), year: childBirthYear })}`
                          : ""}
                      </p>
                      <p><strong>{t("onboarding.summary.childAreas")}</strong> {t("onboarding.summary.selected", { count: childModules.length })}</p>
                    </>
                  )}
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={() => handleCompleteOnboarding()} disabled={isSubmitting}>
                  {isSubmitting ? t("onboarding.cg.finishing") : t("onboarding.cg.goHome")}
                </Button>
              </Card>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default OnboardingPage;
