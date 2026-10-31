import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth";
import { ChildPageShell, SharingChoice, useChildSpace } from "../features/child-space";
import { ROUTES } from "../routes";
import { ToolThemePicker, useAppTheme } from "../features/themes";
import { LanguageSection } from "../components/ui/LanguageSwitch";

// /child/settings: the 15+ sharing choice, low-sensory mode on this device and
// (with the ADHD or autism module, unless a grown-up locked it) the theme.
export const ChildSettingsPage: React.FC = () => {
  const { child, settings, setSettings, lowSensory, setLowSensoryOnThisDevice } = useChildSpace();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const theme = useAppTheme();
  const box = "rounded-3xl bg-white p-5 shadow-card space-y-3";

  return (
    <ChildPageShell title="Settings" backTo={ROUTES.CHILD_HOME}>
      <LanguageSection className={box} />
      <section className={box}>
        {settings.canChangeSharing ? (
          <SharingChoice mode="settings" onAnswered={setSettings} />
        ) : (
          <>
            <h2 className="font-display text-xl font-bold">What your grown-ups can see</h2>
            <p className="text-sm text-charcoal/80">
              Your grown-ups can see what you do in SafeSpace. When you're 15, you'll be able to choose.
            </p>
          </>
        )}
      </section>

      {theme.offered && (
        <section className={box}>
          <h2 className="font-display text-xl font-bold">My theme</h2>
          {theme.canChoose ? (
            <ToolThemePicker look="plain" value={theme.chosen} onChange={theme.choose} lowSensory={theme.lowSensory} />
          ) : (
            <p className="text-sm text-charcoal/80">Your grown-up chose this theme for you.</p>
          )}
        </section>
      )}

      <section className={box}>
        <h2 className="font-display text-xl font-bold">Calm mode</h2>
        <label className="mt-0 flex items-start gap-3 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={lowSensory}
            onChange={(e) => setLowSensoryOnThisDevice(e.target.checked)}
            className="mt-1 h-5 w-5 accent-botanical-700"
          />
          <span>
            Fewer colours and no moving pictures
            <span className="block text-xs text-charcoal/70">
              Only on this device. {child.lowSensoryDefault ? "Your grown-up turned this on for you." : ""}
            </span>
          </span>
        </label>
        <button type="button" onClick={() => setLowSensoryOnThisDevice(null)} className="text-xs font-semibold text-botanical-800 underline">
          Use my grown-up's setting
        </button>
      </section>

      <section className={box}>
        <button
          type="button"
          onClick={async () => {
            await logout().catch(() => {});
            navigate(ROUTES.CHILD_PIN, { replace: true });
          }}
          className="w-full rounded-2xl border border-botanical-900/10 bg-white px-4 py-3 text-sm font-semibold text-charcoal"
        >
          Log out
        </button>
      </section>
    </ChildPageShell>
  );
};

export default ChildSettingsPage;
