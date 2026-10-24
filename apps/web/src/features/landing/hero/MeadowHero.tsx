import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./meadowHero.css";
import { EXPLORE_CARDS, SCENE_PLATE, SCENE_VIDEO, prefersReducedMotion } from "./heroScene";
import { ROUTES } from "../../../routes";

// The landing hero: a sunny painted hillside (one still plate and a looping
// video of the same plate) under the SafeSpace welcome, the ways in, and three
// cards for what's inside. Layout, motion and phone behaviour follow the
// design brief; the words are SafeSpace's.

const NAV = [
  { label: "Features", href: "#features" },
  { label: "Tools", href: "#showcase" },
  { label: "Families", href: "#about" },
  { label: "Promise", href: "#promise" },
];

export const Sprout: React.FC = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" fill="#fff">
    <path d="M15 30c0-7 0-11 1-15" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <path d="M16 16c-1-6-6-10-13-10 0 7 5 11 13 10Z" />
    <path d="M16.5 13c1.5-5 6-8.5 12.5-8 .2 6.5-4.5 10-12.5 8Z" opacity=".92" />
  </svg>
);

// The entrance, run once: logo, nav and Log in drop in; the kicker un-blurs;
// each headline line springs up out of a blur; then the subline, the buttons,
// the row title and link, and the cards rise in turn.
function playEntrance(root: HTMLElement) {
  const q = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));
  const steps: [HTMLElement[], Keyframe[], number, number][] = [];
  const drop: Keyframe[] = [{ opacity: 0, transform: "translateY(-18px)" }, { opacity: 1, transform: "translateY(0)" }];
  const rise: Keyframe[] = [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }];
  steps.push([q(".mh-logo, .mh-navpill, .mh-login"), drop, 0, 0.08]);
  steps.push([q(".mh-kicker"), [{ opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0)" }], 0.3, 0]);
  steps.push([q(".mh-headline span"), [
    { opacity: 0, filter: "blur(12px)", transform: "translateY(40px) scale(.96)" },
    { opacity: 1, filter: "blur(0)", transform: "translateY(-4px) scale(1.01)", offset: 0.7 },
    { opacity: 1, filter: "blur(0)", transform: "translateY(0) scale(1)" },
  ], 0.45, 0.16]);
  steps.push([q(".mh-sub, .mh-start, .mh-child, .mh-row-title, .mh-link, .mh-card"), rise, 0.95, 0.09]);
  for (const [els, frames, start, gap] of steps) {
    els.forEach((el, i) => {
      el.animate(frames, {
        duration: frames.length > 2 ? 900 : 700,
        delay: (start + i * gap) * 1000,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "backwards",
      });
    });
  }
}

export const MeadowHero: React.FC = () => {
  const root = useRef<HTMLElement>(null);
  const [calm] = useState(prefersReducedMotion);

  useEffect(() => {
    if (!calm && root.current && typeof root.current.animate === "function") playEntrance(root.current);
  }, [calm]);

  return (
    <section ref={root} className="mh" aria-labelledby="mh-title">
      <div className="mh-scene" aria-hidden="true">
        <div className="mh-scene-box">
          <img className="mh-plate" src={SCENE_PLATE} alt="" width={2160} height={1920} decoding="async" />
          {!calm && <video className="mh-video" src={SCENE_VIDEO} autoPlay muted loop playsInline preload="auto" tabIndex={-1} />}
        </div>
      </div>

      <nav className="mh-nav" aria-label="SafeSpace">
        <Link to={ROUTES.HOME} className="mh-logo mh-display">
          <Sprout />
          SafeSpace
        </Link>
        <div className="mh-navpill">
          {NAV.map((n) => <a key={n.label} href={n.href}>{n.label}</a>)}
        </div>
        <Link to={ROUTES.LOGIN} className="mh-pill mh-pill-white mh-login">Log in</Link>
      </nav>

      <div className="mh-frame">
      <div className="mh-copy">
        <p className="mh-kicker mh-display">YOUR CALM CORNER</p>
        <h1 id="mh-title" className="mh-headline mh-display">
          <span>A GENTLE PLACE</span>
          <span>TO FEEL BETTER</span>
        </h1>
        <p className="mh-sub">
          <span>Small, kind tools for feelings, routines and calm,</span>{" "}
          <span>for you or for a child you care for.</span>{" "}
          <span>Private, gentle, and never a diagnosis.</span>
        </p>
        <div className="mh-buttons">
          <Link to={ROUTES.SIGNUP} className="mh-pill mh-pill-white mh-start">Get started</Link>
          <Link to={ROUTES.CHILD_PIN} className="mh-pill mh-pill-glass mh-child">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="12" r="4" />
              <path d="M12 12h9M18 12v3M21 12v2" />
            </svg>
            Child sign-in
          </Link>
        </div>
      </div>

      <div className="mh-row">
        <div className="mh-row-head">
          <h2 className="mh-row-title mh-display">EXPLORE SAFESPACE</h2>
          <a className="mh-link" href="#features">
            see everything <span className="mh-chev" aria-hidden="true">›</span>
          </a>
        </div>
        <ul className="mh-cards">
          {EXPLORE_CARDS.map((c) => (
            <li key={c.title} className="mh-card">
              <a href={c.href} className="mh-card-link" aria-label={`${c.title}: ${c.text}`}>
                <img src={c.image} alt={c.alt} loading="lazy" decoding="async" />
                <span className="mh-card-label">
                  <strong>{c.title}</strong>
                  <span>{c.text}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </section>
  );
};

export default MeadowHero;
