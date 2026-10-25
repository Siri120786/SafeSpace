import React, { useEffect, useRef, useState } from "react";
import { isExitKey } from "../../../calm-tools/lib/lowSensory";
import { STORAGE_PREFIX, getDeviceStoreOwner } from "../../../wellness-ui/store/LocalDeviceStore";
import { canShowOcean, startOcean, type OceanScene } from "./oceanScene";

interface OceanShellProps {
  // Low-sensory or reduced motion: the still ocean, no jellyfish moving.
  lowSensory: boolean;
  onExit: () => void;
  exitLabel?: string;
  notice?: string | null;
  // While breathing: one jellyfish pulse per breath of this many seconds.
  pulsePeriod?: number | null;
  children: React.ReactNode;
}

// Remembered per person on this device (cleared on sign-out, like the tools).
const pausedKey = () => {
  const owner = getDeviceStoreOwner();
  return owner ? `${STORAGE_PREFIX}${owner}.ocean-paused` : null;
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
 * Calm Space's frame (role-flow anxiety module): the ocean behind, Aurelia's
 * jellyfish drifting in it (a still ocean in low-sensory mode, before they
 * load, or where the browser can't show them), a pause button, an Exit that
 * Escape also triggers, and the credit.
 */
export const OceanShell: React.FC<OceanShellProps> = ({ lowSensory, onExit, exitLabel = "Exit", notice, pulsePeriod = null, children }) => {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<OceanScene | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(readPaused);
  const moving = !lowSensory && canShowOcean();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isExitKey(e.key)) onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  useEffect(() => {
    if (!moving || !host.current) return;
    let alive = true;
    startOcean(host.current).then((s) => {
      if (!alive) {
        s?.dispose();
        return;
      }
      scene.current = s;
      if (s) {
        s.setPaused(readPaused());
        setReady(true);
      }
    });
    return () => {
      alive = false;
      scene.current?.dispose();
      scene.current = null;
      setReady(false);
    };
  }, [moving]);

  useEffect(() => {
    scene.current?.setPaused(paused);
  }, [paused, ready]);

  useEffect(() => {
    scene.current?.setPulsePeriod(pulsePeriod);
  }, [pulsePeriod, ready]);

  const togglePaused = () => {
    const next = !paused;
    setPaused(next);
    writePaused(next);
  };

  return (
    <div className="oc" data-low-sensory={lowSensory ? "true" : "false"}>
      <div className="oc-water" aria-hidden="true">
        <div className="oc-still" />
        <div ref={host} className="oc-canvas" data-ready={ready ? "true" : "false"} />
        <div className="oc-veil" />
      </div>
      <div className="oc-frame">
        <div className="oc-top">
          <span />
          <div className="oc-top-actions">
            {moving && ready && (
              <button type="button" className="oc-btn oc-btn-glass oc-btn-sm" aria-pressed={paused} onClick={togglePaused}>
                {paused ? "▶ Let them swim" : "⏸ Pause the jellyfish"}
              </button>
            )}
            <button type="button" className="oc-btn oc-btn-glass oc-btn-sm" onClick={onExit}>
              {exitLabel}
            </button>
          </div>
        </div>
        {notice && <p role="status" className="oc-notice">{notice}</p>}
        <main>{children}</main>
        <p className="oc-foot">
          Press Escape at any time to leave. Calming exercises, not medical advice.
          <br />
          Jellyfish: <a href="https://github.com/holtsetio/aurelia" target="_blank" rel="noreferrer">Aurelia</a> by Holtsetio (MIT licence).
        </p>
      </div>
    </div>
  );
};

export default OceanShell;
