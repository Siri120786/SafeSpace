import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyChildProfile, logOut } from "@safespace/api-client";
import type { Child, ModuleKey } from "@safespace/shared-types";
import { getStoredChildSession, clearChildSession } from "../lib/childSessionStorage";
import { SafeSpaceCard } from "../components/ui/SafeSpaceCard";
import { SafeSpaceButton } from "../components/ui/SafeSpaceButton";
import { SafeSpaceBrandHeader } from "../components/ui/SafeSpaceBrandHeader";
import { ROUTES } from "../routes";

interface Props {
  onLogOut: () => void;
}

const MODULE_META: Record<ModuleKey, { name: string; emoji: string }> = {
  autism: { name: "My Space", emoji: "🌿" },
  adhd: { name: "Focus Zone", emoji: "⚡" },
  anxiety: { name: "Calm Space", emoji: "🌊" },
  depression: { name: "Bright Days", emoji: "☀️" },
  ptsd: { name: "Safe Harbor", emoji: "⚓" },
  pcos_pcod: { name: "Cycle Care", emoji: "🌸" },
};

export default function UserViewPage({ onLogOut }: Props) {
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [openModule, setOpenModule] = useState<ModuleKey | null>(null);

  useEffect(() => {
    const session = getStoredChildSession();
    if (!session) {
      onLogOut();
      return;
    }
    getMyChildProfile(session)
      .then((c) => {
        setChild(c);
        if (c.assignedModules.length === 1) {
          setOpenModule(c.assignedModules[0]);
        }
      })
      .catch(() => onLogOut());
  }, [onLogOut]);

  async function handleLogOut() {
    clearChildSession();
    await logOut().catch(() => {});
    onLogOut();
  }

  if (!child) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4 sm:p-6">
        <SafeSpaceCard maxW="md" className="text-center">
          <p className="text-sm font-semibold text-botanical-800">Loading your space…</p>
        </SafeSpaceCard>
      </div>
    );
  }

  if (child.assignedModules.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4 sm:p-6">
        <SafeSpaceCard maxW="md" className="text-center space-y-4">
          <SafeSpaceBrandHeader
            title={`Hi ${child.name}!`}
            subtitle="No spaces have been set up for you yet. Ask your caregiver to add one in Settings."
          />
          <div className="pt-2">
            <SafeSpaceButton variant="secondary" onClick={handleLogOut} className="w-full">
              Log out
            </SafeSpaceButton>
          </div>
        </SafeSpaceCard>
      </div>
    );
  }

  if (openModule) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4 sm:p-6">
        <SafeSpaceCard maxW="md" className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-botanical-100 text-botanical-700 mx-auto flex items-center justify-center text-2xl">
            {MODULE_META[openModule].emoji}
          </div>
          <h1 className="font-display text-3xl font-bold text-charcoal">
            {MODULE_META[openModule].name}
          </h1>
          <p className="text-sm text-charcoal/70 leading-relaxed">
            Welcome to your space! Reflection and routine tools will appear here.
          </p>
          <div className="pt-4 space-y-2">
            <SafeSpaceButton onClick={() => navigate(ROUTES.CHILD_MOOD)} className="w-full">
              How am I feeling?
            </SafeSpaceButton>
            {child.assignedModules.length > 1 && (
              <SafeSpaceButton
                variant="secondary"
                onClick={() => setOpenModule(null)}
                className="w-full"
              >
                &larr; Choose a different space
              </SafeSpaceButton>
            )}
            <SafeSpaceButton variant="ghost" onClick={handleLogOut} className="w-full">
              Log out
            </SafeSpaceButton>
          </div>
        </SafeSpaceCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4 sm:p-6">
      <SafeSpaceCard maxW="md">
        <div className="text-center space-y-2 mb-6">
          <span className="text-xs font-semibold text-botanical-700 uppercase tracking-wider">
            Hi {child.name}!
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-charcoal">
            Where do you want to go?
          </h1>
        </div>

        <div className="space-y-3">
          {child.assignedModules.map((key) => (
            <button
              key={key}
              onClick={() => setOpenModule(key)}
              className="w-full p-4 rounded-2xl bg-ivory-100 hover:bg-ivory-200 border border-botanical-900/10 transition-all flex items-center justify-between text-left group focus:outline-none focus:ring-2 focus:ring-botanical-700"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{MODULE_META[key].emoji}</span>
                <span className="font-display font-bold text-base text-charcoal group-hover:text-botanical-800">
                  {MODULE_META[key].name}
                </span>
              </div>
              <span className="text-sm font-bold text-botanical-700 group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-charcoal/60 mt-6">
          You can switch spaces anytime
        </p>
      </SafeSpaceCard>
    </div>
  );
}
