import { useState } from "react";
import { verifyChildPin } from "@safespace/api-client";
import type { ChildSession } from "@safespace/shared-types";
import { storeChildSession, getStoredFamilyCode, storeFamilyCode } from "../lib/childSessionStorage";
import { SafeSpaceCard } from "../components/ui/SafeSpaceCard";
import { SafeSpaceInput } from "../components/ui/SafeSpaceInput";
import { SafeSpaceButton } from "../components/ui/SafeSpaceButton";
import { SafeSpaceBrandHeader } from "../components/ui/SafeSpaceBrandHeader";

interface Props {
  onBack: () => void;
  onVerified: (session: ChildSession) => void;
}

export default function ChildPinPage({ onBack, onVerified }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [familyCode, setFamilyCode] = useState<string | null>(getStoredFamilyCode());
  const [codeInput, setCodeInput] = useState("");

  async function handleDigit(d: string) {
    if (checking) return;
    if (error) {
      setPin("");
      setError(false);
      return;
    }
    if (d === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setChecking(true);
      try {
        const session = await verifyChildPin(familyCode!, next);
        storeChildSession(session);
        onVerified(session);
      } catch {
        setError(true);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 650);
      } finally {
        setChecking(false);
      }
    }
  }

  // First time on this device: ask for the family code once.
  if (!familyCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4 sm:p-6">
        <SafeSpaceCard maxW="md">
          <div className="flex justify-start mb-2">
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-bold text-botanical-700 hover:text-botanical-900 transition-colors"
            >
              &larr; Back
            </button>
          </div>

          <SafeSpaceBrandHeader
            title="Family Code Required"
            subtitle="Ask a grown-up for your family code. You only need to enter it once on this device."
          />

          <div className="space-y-4 mt-6">
            <SafeSpaceInput
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              maxLength={6}
              placeholder="e.g. A1B2C3"
              style={{ textTransform: "uppercase" }}
            />

            <SafeSpaceButton
              disabled={codeInput.trim().length < 6}
              onClick={() => {
                storeFamilyCode(codeInput.trim());
                setFamilyCode(codeInput.trim().toUpperCase());
              }}
              className="w-full py-3.5"
            >
              Continue &rarr;
            </SafeSpaceButton>
          </div>
        </SafeSpaceCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4 sm:p-6">
      <SafeSpaceCard maxW="md" className="text-center">
        <div className="flex justify-start mb-2">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-bold text-botanical-700 hover:text-botanical-900 transition-colors"
          >
            &larr; Back
          </button>
        </div>

        <SafeSpaceBrandHeader
          title="Hi! Enter your PIN"
          subtitle="Ask a grown-up if you forget your code"
        />

        {/* PIN Dots */}
        <div className="flex justify-center items-center gap-3.5 my-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                error
                  ? "border-coral-500 bg-coral-500"
                  : i < pin.length
                  ? "border-botanical-600 bg-botanical-600 shadow-sm"
                  : "border-botanical-900/20 bg-transparent"
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => handleDigit(String(n))}
              className="aspect-square rounded-2xl bg-ivory-100 hover:bg-ivory-200 border border-botanical-900/10 text-charcoal font-display font-bold text-2xl cursor-pointer active:scale-95 transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-botanical-700"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit("0")}
            className="aspect-square rounded-2xl bg-ivory-100 hover:bg-ivory-200 border border-botanical-900/10 text-charcoal font-display font-bold text-2xl cursor-pointer active:scale-95 transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-botanical-700"
          >
            0
          </button>
          <button
            onClick={() => handleDigit("back")}
            className="aspect-square rounded-2xl bg-ivory-100 hover:bg-ivory-200 border border-botanical-900/10 text-charcoal font-bold text-xl cursor-pointer active:scale-95 transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-botanical-700"
          >
            ⌫
          </button>
        </div>
      </SafeSpaceCard>
    </div>
  );
}
