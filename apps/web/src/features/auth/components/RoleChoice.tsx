import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface RoleChoiceProps {
  mode: "login" | "signup";
}

// The three ways into SafeSpace (docs/role-flow/CONTRACT.md section 3).
// Individuals and caregivers continue to email sign-in or sign-up with their
// role chosen; children always sign in with the family code and PIN.
export const RoleChoice: React.FC<RoleChoiceProps> = ({ mode }) => {
  const { t } = useTranslation();
  const base = mode === "login" ? "/login" : "/signup";
  const options = [
    { key: "individual", to: `${base}?as=individual`, icon: "🌱" },
    { key: "caregiver", to: `${base}?as=caregiver`, icon: "🤝" },
    { key: "child", to: "/child/pin", icon: "🧒" },
  ].map((o) => ({ ...o, title: t(`auth.role.${o.key}.title`), text: t(`auth.role.${o.key}.${mode}`) }));

  return (
    <div className="space-y-3">
      <p className="text-sm text-textMuted text-center">
        {t(mode === "login" ? "auth.role.whoLogin" : "auth.role.whoSignup")}
      </p>
      {options.map((o) => (
        <Link
          key={o.key}
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
