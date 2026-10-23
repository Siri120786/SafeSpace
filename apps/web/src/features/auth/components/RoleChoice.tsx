import React from "react";
import { Link } from "react-router-dom";

interface RoleChoiceProps {
  mode: "login" | "signup";
}

// The three ways into SafeSpace (docs/role-flow/CONTRACT.md section 3).
// Individuals and caregivers continue to email sign-in or sign-up with their
// role chosen; children always sign in with the family code and PIN.
export const RoleChoice: React.FC<RoleChoiceProps> = ({ mode }) => {
  const base = mode === "login" ? "/login" : "/signup";
  const options = [
    {
      to: `${base}?as=individual`,
      title: "Individual",
      text: mode === "login" ? "Your own wellbeing tools." : "For your own wellbeing.",
      icon: "🌱",
    },
    {
      to: `${base}?as=caregiver`,
      title: "Caregiver",
      text: mode === "login" ? "Your children's progress and routines." : "To support a child (or several).",
      icon: "🤝",
    },
    {
      to: "/child/pin",
      title: "Child",
      text: mode === "login"
        ? "Sign in with your family code and PIN."
        : "Children don't sign up: a grown-up adds you, then you sign in with your family code and PIN.",
      icon: "🧒",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-textMuted text-center">
        {mode === "login" ? "Who's signing in?" : "Who is this account for?"}
      </p>
      {options.map((o) => (
        <Link
          key={o.title}
          to={o.to}
          className="flex items-center gap-4 rounded-2xl border border-olive-100 bg-white px-4 py-4 transition-colors hover:bg-olive-50 focus:outline-none focus:ring-2 focus:ring-olive-500"
        >
          <span aria-hidden="true" className="text-2xl">{o.icon}</span>
          <span className="flex-1 text-left">
            <span className="block font-display text-base font-medium text-textHeading">{o.title}</span>
            <span className="block text-xs text-textMuted font-light">{o.text}</span>
          </span>
          <span aria-hidden="true" className="text-deepGreen font-semibold">&rarr;</span>
        </Link>
      ))}
    </div>
  );
};

export default RoleChoice;
