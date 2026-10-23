import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../features/auth";
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
  acceptCaregiverInvite,
} from "@safespace/api-client";
import { Card } from "../components/ui/Card";
import { InputField } from "../components/ui/InputField";
import { Button } from "../components/ui/Button";
import { BrainMascot } from "../components/vectors/BrainMascot";
import { LeafCluster } from "../components/vectors/LeafFrame";

const SUPPORT_AREA_OPTIONS: { key: ModuleKey; label: string; desc: string; icon: string }[] = [
  { key: "anxiety", label: "Anxiety & Calm", desc: "Breathing, grounding & gentle reframing", icon: "🌱" },
  { key: "adhd", label: "ADHD & Focus", desc: "Micro-tasking, structure & focus timers", icon: "⚡" },
  { key: "autism", label: "Autism & Routine", desc: "Sensory ease, predictability & clarity", icon: "🧩" },
  { key: "depression", label: "Depression & Hope", desc: "Low-energy steps & gentle encouragement", icon: "🌤️" },
  { key: "ptsd", label: "PTSD & Safety", desc: "Grounding exercises & comforting routines", icon: "🛡️" },
  { key: "pcos_pcod", label: "PCOS / PCOD Wellbeing", desc: "Hormonal balance, rest & self-care", icon: "🌸" },
];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const INVITE_ERRORS: Record<string, string> = {
  invite_invalid: "That invite code isn't valid or has expired. Ask for a new one.",
  already_caregiver: "You already help look after this child.",
};

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null) {
    const obj = err as { message?: string };
    if (obj.message) return obj.message;
  }
  return "An unexpected error occurred during setup. Please try again.";
}

export const OnboardingPage: React.FC = () => {
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
  const [inviteCode, setInviteCode] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);

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
      setErrorMsg("Please enter your name to continue.");
      return;
    }

    // Save intermediate progress on steps
    try {
      if (currentStep === 1 && displayName.trim() && displayName.trim() !== session.profile.displayName) {
        await updateUserProfile(profileId, { displayName: displayName.trim() });
      } else if (currentStep === 2 && !isCaregiver) {
        await saveSupportPreferences({ profileId, supportAreas: userSupportAreas }).catch(() => null);
      } else if (currentStep === 3 && !isCaregiver) {
        await saveAccessibilityPreferences({ profileId, ...accessibility }).catch(() => null);
      }
    } catch (e) {
      console.warn("Intermediate save warning:", e);
    }

    if (isCaregiver && currentStep === 2) {
      if (!childName.trim()) {
        setErrorMsg("Please enter your child's name.");
        return;
      }
      if (!isValidChildBirth(childBirthYear, childBirthMonth) || !/^\d{4}$/.test(childPin)) {
        setErrorMsg("Enter your child's birth month and year (age 4 to 17) and a 4-digit PIN.");
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

  const handleJoinInvite = async () => {
    setErrorMsg(null);
    setIsJoining(true);
    try {
      await acceptCaregiverInvite(inviteCode);
      setChildSetup("joined");
      updateStep(4);
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      setErrorMsg(INVITE_ERRORS[code] ?? "Couldn't join with that code right now. Please try again.");
    } finally {
      setIsJoining(false);
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
            throw new Error("Enter your child's birth month and year (age 4 to 17) and a 4-digit PIN.");
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
      setErrorMsg(extractErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#FAF7F2] to-paleLime/40 flex flex-col justify-center items-center py-10 px-4 sm:px-6 font-sans relative overflow-hidden">
      {/* Corner Plant Leaves */}
      <LeafCluster position="bottom-left" size={180} className="absolute bottom-0 left-0 opacity-70 pointer-events-none" />
      <LeafCluster position="top-right" size={180} className="absolute top-0 right-0 opacity-70 pointer-events-none" />

      {/* Onboarding Container */}
      <div className="w-full max-w-lg relative z-10">
        
        {/* Header Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-sm font-medium text-textBody hover:text-deepGreen transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
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
            Skip
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold text-base ml-2">&times;</button>
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
                  <BrainMascot stance="waving" size={150} showBubble={true} bubbleText="Hi there!" />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
                    What should we call you?
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Enter your preferred name or nickname for SafeSpace.
                  </p>
                </div>
                <div className="text-left">
                  <InputField
                    label="Your Name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex"
                    autoFocus
                  />
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  Continue
                </Button>
              </Card>
            )}

            {/* USER STEP 2: Support Preferences */}
            {currentStep === 2 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    Step 2 of 4
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    What would you like support with?
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Choose the areas you'd like SafeSpace to support you with.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-h-72 overflow-y-auto pr-1">
                  {SUPPORT_AREA_OPTIONS.map((area) => {
                    const isSelected = userSupportAreas.includes(area.key);
                    return (
                      <button
                        key={area.key}
                        type="button"
                        onClick={() => handleToggleUserSupportArea(area.key)}
                        className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all text-left ${
                          isSelected
                            ? "bg-olive-50/80 border-olive-500 ring-2 ring-olive-500/50 shadow-sm"
                            : "bg-white border-olive-100 hover:border-olive-300"
                        }`}
                      >
                        <span className="text-xl shrink-0">{area.icon}</span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-medium text-textHeading">{area.label}</h4>
                          <p className="text-[11px] text-textMuted font-light mt-0.5 leading-snug">
                            {area.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  Continue
                </Button>
              </Card>
            )}

            {/* USER STEP 3: Accessibility Preferences */}
            {currentStep === 3 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    Step 3 of 4
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    Make SafeSpace comfortable for you
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Configure sensory and display accessibility options.
                  </p>
                </div>
                <div className="space-y-3 text-left">
                  {[
                    { key: "reducedSensoryStimulation", label: "Reduced Sensory Stimulation", desc: "Muted colors and simplified visuals" },
                    { key: "largerText", label: "Larger Text", desc: "Increase font sizing across screens" },
                    { key: "readAloud", label: "Read Aloud Support", desc: "Enable audio descriptions" },
                    { key: "simplifiedPresentation", label: "Simplified Presentation", desc: "Clutter-free, direct layouts" },
                  ].map((opt) => {
                    const k = opt.key as keyof typeof accessibility;
                    const isChecked = accessibility[k];
                    return (
                      <button
                        key={opt.key}
                        type="button"
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
                  Continue
                </Button>
              </Card>
            )}

            {/* USER STEP 4: Review & Complete */}
            {currentStep === 4 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div className="flex justify-center">
                  <BrainMascot stance="celebrating" size={150} showBubble={true} bubbleText="All set!" />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
                    All set, {displayName || "friend"}! 🎉
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Your personal SafeSpace is ready for you.
                  </p>
                </div>
                <div className="bg-olive-50/60 p-4 rounded-2xl border border-olive-100 text-left space-y-2 text-xs text-textBody">
                  <p><strong>Name:</strong> {displayName}</p>
                  <p><strong>Support Areas:</strong> {userSupportAreas.length} selected</p>
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={() => handleCompleteOnboarding()} disabled={isSubmitting}>
                  {isSubmitting ? "Setting up..." : "Enter SafeSpace"}
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
                  <BrainMascot stance="happy" size={150} showBubble={true} bubbleText="Caregiver Portal" />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
                    Let's set up your SafeSpace
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    First, tell us your caregiver display name.
                  </p>
                </div>
                <div className="text-left">
                  <InputField
                    label="Caregiver / Lead Name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Smith"
                    autoFocus
                  />
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  Continue
                </Button>
              </Card>
            )}

            {/* CAREGIVER STEP 2a: Add a child, join with an invite, or skip */}
            {currentStep === 2 && childSetup === "choose" && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    Step 2 of 4
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    Who are you looking after?
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Add a child, or join a child another caregiver already added.
                  </p>
                </div>
                <div className="space-y-3 text-left">
                  {[
                    { key: "add" as const, title: "Add your first child", text: "Their name, birth month and year, and a PIN.", icon: "🧒" },
                    { key: "join" as const, title: "Join with an invite code", text: "Another caregiver gave you an 8-character code.", icon: "🔑" },
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
                  Skip for now: I'll add a child later
                </button>
              </Card>
            )}

            {/* CAREGIVER STEP 2b: Join with an invite code */}
            {currentStep === 2 && childSetup === "join" && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    Step 2 of 4
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    Join with an invite code
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Codes work once and last 48 hours.
                  </p>
                </div>
                <div className="text-left">
                  <InputField
                    label="Invite code"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABCD-2345"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={handleJoinInvite}
                  disabled={isJoining || inviteCode.replace(/[\s-]/g, "").length !== 8}
                >
                  {isJoining ? "Joining..." : "Join"}
                </Button>
              </Card>
            )}

            {/* CAREGIVER STEP 2c: Child Setup */}
            {currentStep === 2 && childSetup === "add" && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    Step 2 of 4
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    Who are you setting up SafeSpace for?
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Enter child details to create their scoped SafeSpace profile.
                  </p>
                </div>
                <div className="text-left space-y-4">
                  <InputField
                    label="Child Name"
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="e.g. Leo"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-textHeading">
                      Birth month
                      <select
                        value={childBirthMonth}
                        onChange={(e) => setChildBirthMonth(e.target.value ? Number(e.target.value) : "")}
                        className="rounded-2xl border border-olive-200 bg-white px-4 py-3 text-sm font-normal"
                      >
                        <option value="">Month</option>
                        {MONTH_NAMES.map((m, i) => (
                          <option key={m} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <InputField
                      label="Birth year"
                      type="number"
                      value={childBirthYear}
                      onChange={(e) => setChildBirthYear(e.target.value ? Number(e.target.value) : "")}
                      placeholder="e.g. 2017"
                    />
                  </div>
                  <InputField
                    label="Child PIN"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={childPin}
                    onChange={(e) => setChildPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="4 digits"
                    helperText="Your child signs in with your family code and this PIN."
                  />
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  Continue
                </Button>
              </Card>
            )}

            {/* CAREGIVER STEP 3: Child Support Modules */}
            {currentStep === 3 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                    Step 3 of 4
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading mt-3">
                    Choose support areas for {childName || "your child"}
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Which areas would you like SafeSpace to support for {childName || "your child"}?
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-h-72 overflow-y-auto pr-1">
                  {SUPPORT_AREA_OPTIONS.map((area) => {
                    const isSelected = childModules.includes(area.key);
                    return (
                      <button
                        key={area.key}
                        type="button"
                        onClick={() => handleToggleChildModule(area.key)}
                        className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all text-left ${
                          isSelected
                            ? "bg-olive-50/80 border-olive-500 ring-2 ring-olive-500/50 shadow-sm"
                            : "bg-white border-olive-100 hover:border-olive-300"
                        }`}
                      >
                        <span className="text-xl shrink-0">{area.icon}</span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-medium text-textHeading">{area.label}</h4>
                          <p className="text-[11px] text-textMuted font-light mt-0.5 leading-snug">
                            {area.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={handleNext}>
                  Continue
                </Button>
              </Card>
            )}

            {/* CAREGIVER STEP 4: Review & Complete */}
            {currentStep === 4 && (
              <Card className="p-8 border border-white shadow-2xl text-center space-y-6">
                <div className="flex justify-center">
                  <BrainMascot stance="celebrating" size={150} showBubble={true} bubbleText="All ready!" />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-textHeading">
                    Setup Complete, {displayName || "Caregiver"}! 🎉
                  </h2>
                  <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
                    Your caregiver portal and child space configuration are ready.
                  </p>
                </div>
                <div className="bg-olive-50/60 p-4 rounded-2xl border border-olive-100 text-left space-y-2 text-xs text-textBody">
                  <p><strong>Caregiver Lead:</strong> {displayName}</p>
                  {childSetup === "joined" && <p><strong>Joined:</strong> you can now see the child you were invited to.</p>}
                  {childSetup === "skipped" && <p>You can add a child or join one with an invite later, from your caregiver home.</p>}
                  {childSetup === "add" && childName && (
                    <>
                      <p><strong>Child Profile:</strong> {childName}{childBirthMonth && childBirthYear ? ` (born ${MONTH_NAMES[(childBirthMonth as number) - 1]} ${childBirthYear})` : ""}</p>
                      <p><strong>Child Support Modules:</strong> {childModules.length} selected</p>
                    </>
                  )}
                </div>
                <Button variant="primary" fullWidth size="lg" onClick={() => handleCompleteOnboarding()} disabled={isSubmitting}>
                  {isSubmitting ? "Finishing setup..." : "Go to your caregiver home"}
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
