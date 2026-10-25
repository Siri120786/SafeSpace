import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isExitKey } from "../../../calm-tools/lib/lowSensory";
import { STORAGE_PREFIX, getDeviceStoreOwner } from "../../../wellness-ui/store/LocalDeviceStore";

// The PCOS / PCOD room: a dusk hillside, a woman reading among the flowers
// while the clouds drift. The scene is the Mindloop preview (MotionSites),
// cut below its own headline; the sky above it is drawn in CSS to match.
const MOVING = new URL("./hillside.webp", import.meta.url).href;
const STILL = new URL("./hillside-still.webp", import.meta.url).href;

export type DuskPage = "hub" | "cycle-care" | "exercise" | "food";

interface DuskShellProps {
  title: string;
  // Shown over the sky instead of the title (the hub's quote).
  heading?: string;
  lead?: string;
  // Which page this is: the hub gets the full hillside hero, the others a
  // shorter one. Also marks the current link in the top bar.
  page: DuskPage;
  // Where the modules are mounted (/modules).
  base: string;
  // Low-sensory or reduced motion: the still hillside.
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
  children: React.ReactNode;
}

// The care spaces, in order: the top bar lists them, and each page ends with
// an arrow to the next one (Food leads back to the Overview).
const LINKS: { page: DuskPage; label: string; path: string; blurb: string }[] = [
  { page: "hub", label: "Overview", path: "pcos-pcod", blurb: "What PCOS and PCOD mean, your health profile, and myths and facts." },
  { page: "cycle-care", label: "Cycle Care", path: "pcos-pcod/cycle-care", blurb: "Check-ins, medicine notes and reminders, doctor-visit prep." },
  { page: "exercise", label: "Exercise", path: "pcos-pcod/exercise", blurb: "Daily minutes, yoga time and a weekly workout plan." },
  { page: "food", label: "Food", path: "pcos-pcod/food", blurb: "Diet plan, rewards, water and meal ideas." },
];
const nextAfter = (page: DuskPage) => LINKS[(LINKS.findIndex((l) => l.page === page) + 1) % LINKS.length];

// Each care space's photo panel beside its content, with a short line over
// it. The Overview shows the still hillside. `focus` keeps the person (or the
// plate) in frame when the wide photo is cropped to the tall panel.
const PANELS: Record<DuskPage, { photo: string | null; focus?: string; line: string }> = {
  hub: { photo: null, line: "Understanding is the first kindness." },
  "cycle-care": { photo: new URL("./photos/cycle-care.webp", import.meta.url).href, focus: "74% 50%", line: "Small check-ins, steady care." },
  exercise: { photo: new URL("./photos/exercise.webp", import.meta.url).href, focus: "66% 50%", line: "Move in ways that feel good." },
  food: { photo: new URL("./photos/food.webp", import.meta.url).href, focus: "56% 50%", line: "Nourish, never punish." },
};

// Remembered per person on this device (cleared on sign-out, like the tools).
const pausedKey = () => {
  const owner = getDeviceStoreOwner();
  return owner ? `${STORAGE_PREFIX}${owner}.dusk-paused` : null;
};
function readPaused(): boolean {
  try {
    const k = pausedKey();
    return k ? localStorage.getItem(k) === "1" : false;
  } catch {
    return false;
  }
}
function writePaused(paused: boolean) {
  try {
    const k = pausedKey();
    if (k) localStorage.setItem(k, paused ? "1" : "0");
  } catch {
    // Storage blocked: it just won't be remembered.
  }
}

/**
 * The PCOS / PCOD frame: the hillside behind, a top bar with the module's
 * pages, a pause button for the drifting clouds, an Exit that Escape also
 * triggers, and the page's heading over the sky.
 */
export const DuskShell: React.FC<DuskShellProps> = ({ title, heading, lead, page, base, lowSensory, onExit, notice, children }) => {
  const [paused, setPaused] = useState(readPaused);
  // The bar turns to glass once the page scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  const next = nextAfter(page);
  const still = lowSensory || paused;
  const src = still ? STILL : MOVING;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isExitKey(e.key)) onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  // Tiles drift up into place as they scroll into view (not in low-sensory
  // mode). Only tiles marked here are hidden first, so nothing is lost if
  // this never runs.
  useEffect(() => {
    if (lowSensory || typeof IntersectionObserver === "undefined") return;
    const tiles = Array.from(document.querySelectorAll<HTMLElement>(".dk-column main > div > *, .dk-next"));
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("dk-in");
          seen.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const t of tiles) {
      if (t.getBoundingClientRect().top < window.innerHeight) continue;
      t.classList.add("dk-reveal");
      seen.observe(t);
    }
    return () => {
      seen.disconnect();
      for (const t of tiles) t.classList.remove("dk-reveal", "dk-in");
    };
  }, [lowSensory, page]);

  // Switching care space starts the new page at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const togglePaused = () => {
    const next = !paused;
    setPaused(next);
    writePaused(next);
  };
  const toContent = () => document.getElementById("dk-content")?.scrollIntoView({ behavior: lowSensory ? "auto" : "smooth" });

  return (
    <div className="dk" data-low-sensory={lowSensory ? "true" : "false"} data-page={page}>
      <div className="dk-scene" aria-hidden="true">
        <div className="dk-sky" />
        <div className="dk-land">
          <img className="dk-land-soft" src={src} alt="" />
          <img className="dk-land-main" src={src} alt="" />
        </div>
        <div className="dk-lines" />
      </div>

      <header className="dk-bar" data-scrolled={scrolled ? "true" : "false"}>
        <span className="dk-mark dk-serif">SafeSpace</span>
        <nav className="dk-nav" aria-label="Care spaces">
          {LINKS.map((l) => (
            <Link key={l.page} to={`${base}/${l.path}`} aria-current={l.page === page ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="dk-bar-actions">
          {!lowSensory && (
            <button
              type="button"
              className="dk-pill dk-pill-sm"
              aria-pressed={paused}
              aria-label={paused ? "Let the clouds drift" : "Pause the clouds"}
              onClick={togglePaused}
            >
              {paused ? "Play" : "Pause"}
            </button>
          )}
          <button type="button" className="dk-pill dk-pill-sm" onClick={onExit} aria-label={`Exit ${title} and return home`}>
            Exit
          </button>
        </div>
      </header>

      <section className="dk-hero">
        <h1 className="dk-title dk-serif">{heading ?? title}</h1>
        {lead && <p className="dk-lead">{lead}</p>}
        {page === "hub" && (
          <button type="button" className="dk-pill dk-begin" onClick={toContent}>
            Begin
          </button>
        )}
      </section>

      {/* Night falls over the hillside: the page's content sits on a calm,
          solid surface instead of over the moving scene. */}
      <div className="dk-body">
      <div id="dk-content" className="dk-content">
        <aside className="dk-photo" aria-hidden="true" data-own={PANELS[page].photo ? "true" : "false"}>
          <img src={PANELS[page].photo ?? STILL} alt="" style={PANELS[page].focus ? { objectPosition: PANELS[page].focus } : undefined} />
          <span className="dk-photo-text">
            <span className="dk-photo-label">{LINKS.find((l) => l.page === page)?.label}</span>
            <span className="dk-photo-line dk-serif">{PANELS[page].line}</span>
          </span>
        </aside>
        <div className="dk-column">
        {notice && (
          <p role="status" className="dk-notice">
            {notice}
          </p>
        )}
        <main>{children}</main>
        <Link to={`${base}/${next.path}`} className="dk-next">
          <span className="dk-next-text">
            <span className="dk-next-kicker">{next.page === "hub" ? "Back to the start" : "Next care space"}</span>
            <span className="dk-next-name dk-serif">Go to {next.label}</span>
            <span className="dk-next-blurb">{next.blurb}</span>
          </span>
          <span className="dk-next-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
        <p className="dk-foot">
          Press Escape at any time to leave. Self-care ideas, not medical advice.
          <br />
          Hillside scene: Mindloop preview from <a href="https://motionsites.ai" target="_blank" rel="noreferrer">MotionSites</a>.
        </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default DuskShell;
