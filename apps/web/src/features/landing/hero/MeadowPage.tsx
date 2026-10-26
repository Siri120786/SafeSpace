import React from "react";
import { SceneBackdrop } from "./SceneBackdrop";

// A full-screen page in the meadow look (the landing page's boy and puppy,
// softly blurred and still) with the SafeSpace mark in the corner: for forms
// like password reset and the child PIN, and for loading and error screens.
// The content sits centered; `MeadowNote` is a white pill for short messages.

const Sprout: React.FC = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" fill="#fff" className="h-7 w-7">
    <path d="M15 30c0-7 0-11 1-15" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <path d="M16 16c-1-6-6-10-13-10 0 7 5 11 13 10Z" />
    <path d="M16.5 13c1.5-5 6-8.5 12.5-8 .2 6.5-4.5 10-12.5 8Z" opacity=".92" />
  </svg>
);

export const MeadowPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative isolate font-sans">
    <SceneBackdrop />
    <span
      className="absolute left-4 top-4 sm:left-8 sm:top-6 flex items-center gap-2 text-white text-xl sm:text-2xl drop-shadow-[0_2px_8px_rgba(28,70,120,0.45)]"
      style={{ fontFamily: '"Grandstander", "Lexend Deca", sans-serif', fontWeight: 900 }}
    >
      <Sprout />
      SafeSpace
    </span>
    <div className="w-full flex flex-col items-center relative z-10 mt-12 sm:mt-0">{children}</div>
  </div>
);

export const MeadowNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#2f5a30] shadow-[0_8px_20px_rgba(20,60,100,0.18)]">
    {children}
  </p>
);

export default MeadowPage;
