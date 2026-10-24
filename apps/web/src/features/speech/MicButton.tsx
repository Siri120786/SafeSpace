import React, { useEffect, useRef, useState } from "react";
import { dictationErrorText, recognitionCtor } from "./speech";

// Minimal shape of the browser's SpeechRecognition.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export function canDictate(): boolean {
  return typeof window !== "undefined" && recognitionCtor(window) !== null;
}

interface Props {
  // Called with each finished phrase; the field decides how to add it.
  onText: (spoken: string) => void;
  lang?: string;
  disabled?: boolean;
  className?: string;
}

// 🎤 Speak instead of typing. Tap to start, tap again (or stop talking) to
// finish. Hidden where the browser can't turn speech into text.
export const MicButton: React.FC<Props> = ({ onText, lang, disabled, className = "" }) => {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => rec.current?.abort(), []);

  if (!canDictate()) return null;

  function start() {
    const Ctor = recognitionCtor(window) as new () => Recognition;
    const r = new Ctor();
    r.lang = lang ?? "en-IN";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onTextRef.current(res[0].transcript);
      }
    };
    r.onerror = (e) => setError(dictationErrorText(e.error));
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    try {
      r.start();
      setListening(true);
    } catch {
      setError(dictationErrorText("start-failed"));
    }
  }

  function stop() {
    rec.current?.stop();
    setListening(false);
  }

  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Speak instead of typing"}
        title={listening ? "Stop listening" : "Speak instead of typing"}
        className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-olive-500 disabled:opacity-50 ${
          listening ? "border-red-300 bg-red-50 text-red-700" : "border-black/10 bg-white text-charcoal hover:bg-black/5"
        }`}
      >
        <span aria-hidden="true">{listening ? "⏹" : "🎤"}</span>
        <span>{listening ? "Listening…" : "Speak"}</span>
      </button>
      {error && <span role="alert" className="mt-1 text-[11px] text-red-700">{error}</span>}
    </span>
  );
};
