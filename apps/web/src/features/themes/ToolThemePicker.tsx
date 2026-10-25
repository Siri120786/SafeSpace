import React, { useId, useState } from "react";
import { DESIGNED_TOOL_THEMES, TOOL_THEMES, TOOL_THEME_LABELS, toolThemeEmoji, type ToolTheme } from "./toolThemes";

interface Props {
  value: ToolTheme;
  onChange: (theme: ToolTheme) => void;
  // "space": the big "Pick a theme" button on the Space tools page.
  // "plain": a small chooser for the calm look.
  look: "space" | "plain";
  // Low-sensory mode keeps the calm look whatever is picked.
  lowSensory?: boolean;
}

// Choose the tools' theme. Themes still being designed show as "Soon".
export const ToolThemePicker: React.FC<Props> = ({ value, onChange, look, lowSensory = false }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const options = (
    <ul id={listId} className={look === "space" ? "sp-themes sp-glass" : "mt-2 flex flex-wrap gap-2"} aria-label="Themes">
      {TOOL_THEMES.map((t) => {
        const ready = t === "calm" || DESIGNED_TOOL_THEMES.includes(t);
        const on = t === value;
        return (
          <li key={t}>
            <button
              type="button"
              disabled={!ready}
              aria-pressed={on}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className={
                look === "space"
                  ? "sp-theme"
                  : `rounded-full border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-olive-500 disabled:opacity-50 ${
                      on ? "border-olive-500 bg-olive-50 font-semibold text-textHeading" : "border-olive-100 bg-white text-textBody"
                    }`
              }
            >
              <span aria-hidden="true">{toolThemeEmoji(t)}</span> {TOOL_THEME_LABELS[t]}
              {!ready && <span className={look === "space" ? "sp-theme-soon" : "ml-1 text-xs text-textMuted"}>Soon</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (look === "plain") {
    return (
      <div className="text-left">
        <p className="text-sm font-medium text-textHeading">Theme</p>
        {options}
        {lowSensory && value !== "calm" && (
          <p className="mt-2 text-xs text-textMuted">Low-sensory mode is on, so the tools keep the calm look.</p>
        )}
      </div>
    );
  }
  return (
    <div className="sp-pick-wrap">
      <button type="button" className="sp-pick" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen((o) => !o)}>
        <span className="sp-pick-big">Pick</span>
        <span className="sp-pick-small">
          a<br />
          theme
        </span>
        <span className="sp-pick-bar" aria-hidden="true" />
      </button>
      {open && options}
    </div>
  );
};
