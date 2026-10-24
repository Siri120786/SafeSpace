import React from "react";
import type { StoryAction, StoryCharacterId, StoryExpression, StoryPose, StoryProp } from "../storyScript";

// Flat 2D characters drawn from parts, so the player can animate them on the
// device: blink, talk (in time with the words where the browser reports
// them), look at whoever speaks, walk, wave, point, nod, breathe, hop, sit,
// and hold things. Each is drawn with its feet at (0, 0), facing right.
// Animations live in stories.css.

export type MouthMode = "anim" | "open" | "closed";

export interface PoseProps {
  expression: StoryExpression;
  action: StoryAction;
  pose: StoryPose;
  talking: boolean;
  mouth: MouthMode;      // while talking: word-synced (open/closed) or a steady flap (anim)
  look: -1 | 0 | 1;      // in the character's own facing: 1 ahead, -1 behind
  walking: boolean;      // legs step and arms swing
  holding?: StoryProp;
  scale: number;         // the stage scale, so sitting lands on the seat at any size
}

// Every seat on every background is this high above the floor (stage units).
export const SEAT_HEIGHT = 150;

const SKIN = "#C98B5E";
const SKIN_SHADE = "#B5764B";
const HAIR = "#2B1D17";
const INK = "#2B1D17";
const EASE = "transform 0.7s ease";

// ---------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------

const Face: React.FC<{ expression: StoryExpression; talking: boolean; mouth: MouthMode; closedEyes: boolean; look: number; eye?: number }> = ({
  expression,
  talking,
  mouth,
  closedEyes,
  look,
  eye = 1,
}) => {
  const brows: Record<StoryExpression, [string, string]> = {
    calm: ["M-34 -26 q12 -8 24 0", "M10 -26 q12 -8 24 0"],
    happy: ["M-34 -28 q12 -10 24 0", "M10 -28 q12 -10 24 0"],
    worried: ["M-34 -22 q12 -12 24 -6", "M10 -28 q12 6 24 6"],
    surprised: ["M-34 -34 q12 -10 24 0", "M10 -34 q12 -10 24 0"],
  };
  const mouths: Record<StoryExpression, React.ReactNode> = {
    calm: <path d="M-12 22 q12 10 24 0" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />,
    happy: <path d="M-16 18 q16 22 32 0 z" fill="#7A2E2E" stroke={INK} strokeWidth={3} strokeLinejoin="round" />,
    worried: <path d="M-12 28 q6 -8 12 -2 q6 6 12 -2" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />,
    surprised: <ellipse cx={0} cy={26} rx={8} ry={10} fill="#7A2E2E" stroke={INK} strokeWidth={3} />,
  };
  const open = <ellipse cx={0} cy={24} rx={11} ry={9} fill="#7A2E2E" stroke={INK} strokeWidth={3} />;
  const mouthNode = !talking
    ? mouths[expression]
    : mouth === "open"
      ? open
      : mouth === "closed"
        ? mouths[expression]
        : (
          <>
            <g className="st-mouth-shut">{mouths[expression]}</g>
            <g className="st-mouth-open">{open}</g>
          </>
        );
  return (
    <g>
      <path d={brows[expression][0]} fill="none" stroke={HAIR} strokeWidth={5} strokeLinecap="round" />
      <path d={brows[expression][1]} fill="none" stroke={HAIR} strokeWidth={5} strokeLinecap="round" />
      {closedEyes ? (
        <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
          <path d="M-30 -4 q8 8 16 0" />
          <path d="M14 -4 q8 8 16 0" />
        </g>
      ) : (
        <g className="st-blink">
          {[-22, 22].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={-6} rx={11 * eye} ry={13 * eye} fill="#fff" />
              <g style={{ transform: `translateX(${look * 4}px)`, transition: EASE }}>
                <circle cx={x + 2} cy={-4} r={7 * eye} fill={INK} />
                <circle cx={x + 4} cy={-7} r={2.5 * eye} fill="#fff" />
              </g>
            </g>
          ))}
        </g>
      )}
      <circle cx={-34} cy={14} r={8} fill="#E8907A" opacity={0.45} />
      <circle cx={34} cy={14} r={8} fill="#E8907A" opacity={0.45} />
      {mouthNode}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Things to hold (drawn at the hand, so they move with the arm)
// ---------------------------------------------------------------------------

const Prop: React.FC<{ kind: StoryProp; x: number; y: number }> = ({ kind, x, y }) => {
  switch (kind) {
    case "mirror":
      return (
        <g transform={`translate(${x} ${y})`}>
          <rect x={-5} y={-4} width={10} height={70} rx={4} fill="#B8C4C6" />
          <circle cx={0} cy={80} r={20} fill="#E4F3F7" stroke="#B8C4C6" strokeWidth={6} />
        </g>
      );
    case "toothbrush":
      return (
        <g transform={`translate(${x} ${y})`}>
          <rect x={-6} y={-4} width={12} height={90} rx={6} fill="#6FA3D9" />
          <rect x={-10} y={70} width={20} height={26} rx={4} fill="#FFFFFF" stroke="#BFD6D8" strokeWidth={3} />
        </g>
      );
    case "teddy":
      return (
        <g transform={`translate(${x + 10} ${y + 30})`}>
          <circle cx={-18} cy={-34} r={10} fill="#B07A4F" />
          <circle cx={18} cy={-34} r={10} fill="#B07A4F" />
          <circle cx={0} cy={-20} r={22} fill="#C08A5C" />
          <ellipse cx={0} cy={18} rx={24} ry={28} fill="#C08A5C" />
          <circle cx={-7} cy={-22} r={3} fill={INK} />
          <circle cx={7} cy={-22} r={3} fill={INK} />
          <ellipse cx={0} cy={-13} rx={6} ry={4} fill="#7A4E2E" />
        </g>
      );
    case "stethoscope":
      return (
        <g transform={`translate(${x} ${y})`} fill="none" stroke="#5B6B73" strokeWidth={6} strokeLinecap="round">
          <path d="M-14 -6 q-6 50 14 62 q20 -12 14 -62" />
          <path d="M0 56 q0 36 30 40" />
          <circle cx={36} cy={98} r={12} fill="#B8C4C6" stroke="#5B6B73" />
        </g>
      );
    case "backpack":
      return (
        <g transform={`translate(${x} ${y})`}>
          <path d="M-14 -2 q14 -22 28 0" fill="none" stroke="#C0392B" strokeWidth={7} strokeLinecap="round" />
          <rect x={-34} y={0} width={68} height={86} rx={20} fill="#E06C5A" />
          <rect x={-24} y={40} width={48} height={34} rx={10} fill="#C9564A" />
          <rect x={-6} y={46} width={12} height={6} rx={3} fill="#F5D46B" />
        </g>
      );
  }
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

interface PersonLook {
  height: "adult" | "child";
  top: string;         // shirt / kurta / scrubs
  topShade: string;
  bottom: string;      // trousers / shorts / leggings
  shoes: string;
  long?: boolean;      // kurta: a long top
  coat?: boolean;      // white doctor's coat over the top
  hair: (headR: number) => React.ReactNode;    // drawn behind the head
  extras?: (headR: number) => React.ReactNode; // drawn over the head, under the face
  shirtArt?: (shoulderY: number) => React.ReactNode; // a print on the top
}

const Person: React.FC<Omit<PoseProps, "look"> & { outfit: PersonLook; gaze: -1 | 0 | 1 }> = ({
  outfit: look,
  gaze,
  expression,
  action,
  pose,
  talking,
  mouth,
  walking,
  holding,
  scale,
}) => {
  const child = look.height === "child";
  const headR = child ? 76 : 64;
  const legLen = child ? 110 : 190;
  const torsoH = child ? 120 : 160;
  const hipY = -legLen;
  const shoulderY = hipY - torsoH + 10;
  const headY = shoulderY - headR - 6;
  const torsoW = child ? 96 : 116;
  const armLen = child ? 100 : 140;
  const sit = pose === "sit";
  // The right arm (the one nearer the viewer) does the gestures.
  const gesture =
    action === "wave" ? "st-wave"
    : action === "raise_hand" ? "st-raise"
    : action === "point" ? "st-point"
    : holding ? "st-hold"
    : walking ? "st-swing-b"
    : undefined;
  const closedEyes = action === "breathe";

  const leg = (x: number, step: string) => (
    <g key={x} className={walking && !sit ? step : undefined} style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}>
      <rect x={x - 15} y={hipY} width={30} height={legLen - 12} rx={14} fill={look.bottom} />
      <rect x={x - 15} y={hipY + legLen * 0.55} width={30} height={legLen * 0.45 - 12} rx={12} fill={child ? SKIN : look.bottom} />
      <ellipse cx={x + 6} cy={-8} rx={22} ry={11} fill={look.shoes} />
    </g>
  );

  const legs = (
    <g style={sit ? { transformBox: "fill-box", transformOrigin: "50% 0%", transform: "rotate(-78deg)" } : undefined}>
      {leg(-20, "st-step-a")}
      {leg(20, "st-step-b")}
    </g>
  );

  const torso = look.long ? (
    <path
      d={`M${-torsoW / 2} ${shoulderY} h${torsoW} l14 ${torsoH + 40} h${-torsoW - 28} z`}
      fill={look.top}
      stroke={look.topShade}
      strokeWidth={3}
      strokeLinejoin="round"
    />
  ) : (
    <rect x={-torsoW / 2} y={shoulderY} width={torsoW} height={torsoH} rx={child ? 30 : 34} fill={look.top} stroke={look.topShade} strokeWidth={3} />
  );

  const arm = (side: -1 | 1) => {
    const cls = side === 1 ? gesture : walking ? "st-swing-a" : undefined;
    const handY = shoulderY + 6 + armLen;
    return (
      <g className={cls} style={cls ? { transformBox: "fill-box", transformOrigin: "50% 6%" } : undefined}>
        <rect x={side * (torsoW / 2) - 13} y={shoulderY + 6} width={26} height={armLen} rx={13} fill={look.coat ? "#FAFAFA" : look.top} stroke={look.coat ? "#D9D9D9" : look.topShade} strokeWidth={2} />
        {side === 1 && holding && <Prop kind={holding} x={torsoW / 2} y={handY - 10} />}
        <circle cx={side * (torsoW / 2)} cy={handY} r={15} fill={SKIN} />
      </g>
    );
  };

  return (
    <g transform={sit ? `translate(0 ${legLen - SEAT_HEIGHT / scale})` : undefined}>
      <g className={action === "hop" ? "st-hop" : walking ? "st-walk-bob" : undefined}>
        <g className={action === "breathe" ? "st-breathe-deep" : "st-breathe"} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
          {legs}
          {arm(-1)}
          {torso}
          {look.coat && (
            <g>
              <path d={`M${-torsoW / 2 - 6} ${shoulderY} h${torsoW / 2 - 10} v${torsoH + 60} h${-torsoW / 2 + 4} z`} fill="#FAFAFA" stroke="#D9D9D9" strokeWidth={2} />
              <path d={`M${torsoW / 2 + 6} ${shoulderY} h${-torsoW / 2 + 10} v${torsoH + 60} h${torsoW / 2 - 4} z`} fill="#FAFAFA" stroke="#D9D9D9" strokeWidth={2} />
              <rect x={torsoW / 2 - 34} y={shoulderY + 40} width={20} height={6} rx={2} fill="#9DB7D8" />
            </g>
          )}
          {look.shirtArt?.(shoulderY)}
          <rect x={-10} y={shoulderY - 14} width={20} height={20} fill={SKIN_SHADE} />
          <g className={action === "nod" ? "st-nod" : undefined} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
            <g style={{ transformBox: "fill-box", transformOrigin: "50% 100%", transform: `translateX(${gaze * 5}px) rotate(${gaze * 4}deg)`, transition: EASE }}>
              <g transform={`translate(0 ${headY})`}>
                {look.hair(headR)}
                <circle r={headR} fill={SKIN} />
                <ellipse cx={-headR} cy={4} rx={9} ry={13} fill={SKIN_SHADE} />
                <ellipse cx={headR} cy={4} rx={9} ry={13} fill={SKIN_SHADE} />
                {look.extras?.(headR)}
                <Face expression={expression} talking={talking} mouth={mouth} closedEyes={closedEyes} look={gaze} eye={child ? 1.15 : 1} />
              </g>
            </g>
          </g>
          {arm(1)}
        </g>
      </g>
    </g>
  );
};

const LOOKS: Record<Exclude<StoryCharacterId, "pip">, PersonLook> = {
  kai: {
    height: "child",
    top: "#6FA3D9",
    topShade: "#5A8CC0",
    bottom: "#F2C744",
    shoes: "#F4F4F4",
    shirtArt: (y) => (
      <g fill="#F6C945">
        {[[-24, 30], [18, 52], [-8, 84], [28, 96]].map(([x, sy]) => (
          <path key={`${x}${sy}`} d="M0 -7 L2 -2 L7 -2 L3 1 L4 6 L0 3 L-4 6 L-3 1 L-7 -2 L-2 -2 Z" transform={`translate(${x} ${y + sy})`} />
        ))}
      </g>
    ),
    hair: (r) => (
      <g fill={HAIR}>
        {[[-46, -38], [-20, -56], [8, -60], [36, -48], [52, -22], [-56, -10], [-30, -62], [24, -66], [56, 2], [-60, 14],
          [-8, -70], [44, -64], [-48, -54], [62, -36], [-64, -28], [12, -48], [-30, -44], [64, 18]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x * (r / 64)} cy={y * (r / 64)} r={r * 0.34} />
        ))}
      </g>
    ),
  },
  // Kai's friend and classmate, from the character sheet: centre parting, a
  // lock by each ear, a low ponytail with a pink band; pink T-shirt with a
  // daisy, lilac shorts, white trainers with pink.
  jaya: {
    height: "child",
    top: "#F4A7C0",
    topShade: "#E48FAA",
    bottom: "#B9A7E0",
    shoes: "#FBEFF3",
    shirtArt: (y) => (
      <g transform={`translate(8 ${y + 46})`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx={0} cy={-11} rx={7} ry={11} fill="#FFFFFF" transform={`rotate(${a})`} />
        ))}
        <circle r={7} fill="#F6C945" />
      </g>
    ),
    hair: (r) => (
      <g fill={HAIR}>
        {/* Ponytail at the back of the head, then the band. */}
        <ellipse cx={-r * 0.98} cy={r * 0.55} rx={r * 0.34} ry={r * 0.5} transform={`rotate(18 ${-r * 0.98} ${r * 0.55})`} />
        <ellipse cx={-r * 1.12} cy={r * 0.95} rx={r * 0.24} ry={r * 0.3} />
        <path d={`M${-r - 6} 6 q0 ${-r - 22} ${r + 6} ${-r - 14} q${r + 10} -6 ${r + 6} ${r + 14} q-${r * 0.4} -${r * 0.8} -${r + 6} -${r * 0.75} q-${r * 0.6} 0 -${r + 6} ${r * 0.75} z`} />
        <rect x={-r * 1.3} y={r * 0.12} width={r * 0.34} height={r * 0.17} rx={r * 0.08} fill="#F08DB0" transform={`rotate(-20 ${-r * 1.13} ${r * 0.2})`} />
      </g>
    ),
    // Centre-parted hair over the forehead, and a lock in front of each ear.
    extras: (r) => (
      <g fill={HAIR}>
        <path d={`M${-r * 0.99} ${r * 0.05} Q${-r * 0.98} ${-r * 1.02} ${-r * 0.02} ${-r * 0.99} Q${-r * 0.5} ${-r * 0.72} ${-r * 0.82} ${-r * 0.12} z`} />
        <path d={`M${r * 0.99} ${r * 0.05} Q${r * 0.98} ${-r * 1.02} ${r * 0.02} ${-r * 0.99} Q${r * 0.5} ${-r * 0.72} ${r * 0.82} ${-r * 0.12} z`} />
        <ellipse cx={-r * 0.9} cy={r * 0.22} rx={r * 0.13} ry={r * 0.32} />
        <ellipse cx={r * 0.9} cy={r * 0.22} rx={r * 0.13} ry={r * 0.32} />
      </g>
    ),
  },
  amma: {
    height: "adult",
    top: "#F4B9A0",
    topShade: "#E39F84",
    bottom: "#F6EEE6",
    shoes: "#8A5A44",
    long: true,
    hair: (r) => (
      <g fill={HAIR}>
        <path d={`M${-r - 4} 8 q0 ${-r - 18} ${r + 4} ${-r - 10} q${r + 8} -8 ${r + 4} ${r + 10} q-${r * 0.5} -${r * 0.9} -${r + 4} -${r * 0.75} q-${r * 0.6} 0 -${r + 4} ${r * 0.75} z`} />
        <rect x={r * 0.55} y={10} width={18} height={r * 1.9} rx={9} />
      </g>
    ),
    extras: () => <circle cx={0} cy={-30} r={4} fill="#C0392B" />,
  },
  papa: {
    height: "adult",
    top: "#A9C8E8",
    topShade: "#8FB2D6",
    bottom: "#C9B79C",
    shoes: "#5A3E2B",
    hair: (r) => (
      <g fill={HAIR}>
        <path d={`M${-r - 4} 0 q-4 ${-r - 14} ${r + 4} ${-r - 14} q${r + 10} 0 ${r + 4} ${r + 14} q-${r * 0.3} -${r * 0.55} -${r} -${r * 0.6} q-${r * 0.7} 0 -${r + 8} ${r * 0.6} z`} />
        <path d={`M${-r * 0.7} ${-r * 0.78} q${r * 0.7} -${r * 0.35} ${r * 1.5} ${r * 0.1}`} stroke={HAIR} strokeWidth={r * 0.22} fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  maya: {
    height: "adult",
    top: "#B9A7D9",
    topShade: "#A08ECA",
    bottom: "#B9A7D9",
    shoes: "#F0F0F0",
    coat: true,
    hair: (r) => (
      <g fill={HAIR}>
        <circle cx={0} cy={-r - 14} r={r * 0.42} />
        <path d={`M${-r - 2} 2 q0 ${-r - 14} ${r + 2} ${-r - 6} q${r + 4} 0 ${r + 2} ${r + 8} q-${r * 0.5} -${r * 0.8} -${r + 2} -${r * 0.7} q-${r * 0.6} 0 -${r + 2} ${r * 0.7} z`} />
      </g>
    ),
  },
  asha: {
    height: "adult",
    top: "#7FB8A4",
    topShade: "#679F8B",
    bottom: "#F3E6C8",
    shoes: "#8A5A44",
    long: true,
    hair: (r) => (
      <g fill={HAIR}>
        <circle cx={-r * 0.55} cy={-r * 0.85} r={r * 0.4} />
        <path d={`M${-r - 4} 10 q0 ${-r - 18} ${r + 4} ${-r - 10} q${r + 8} -8 ${r + 4} ${r + 18} q-${r * 0.4} -${r * 0.9} -${r + 4} -${r * 0.8} q-${r * 0.6} 0 -${r + 4} ${r * 0.8} z`} />
      </g>
    ),
    // Glasses.
    extras: () => (
      <g fill="none" stroke="#5A3E2B" strokeWidth={4}>
        <circle cx={-22} cy={-6} r={18} />
        <circle cx={22} cy={-6} r={18} />
        <path d="M-4 -8 q4 -4 8 0" />
      </g>
    ),
  },
};

// ---------------------------------------------------------------------------
// Pip the bird
// ---------------------------------------------------------------------------

const Pip: React.FC<Omit<PoseProps, "look"> & { gaze: -1 | 0 | 1 }> = ({ expression, action, talking, mouth, gaze, walking }) => {
  const flap = action === "hop" || action === "wave" || walking;
  const beakClass = talking && mouth === "anim" ? "st-beak" : undefined;
  const beakOpen = talking && mouth === "open";
  return (
    <g className={action === "hop" ? "st-hop" : walking ? "st-walk-bob" : "st-bob"}>
      <g transform="translate(0 -80)">
        <line x1={-14} y1={50} x2={-14} y2={78} stroke="#E8963C" strokeWidth={5} strokeLinecap="round" />
        <line x1={14} y1={50} x2={14} y2={78} stroke="#E8963C" strokeWidth={5} strokeLinecap="round" />
        <g className={flap ? "st-flap-l" : undefined} style={{ transformBox: "fill-box", transformOrigin: "100% 30%" }}>
          <ellipse cx={-62} cy={6} rx={28} ry={16} fill="#7FB3E6" transform="rotate(-25 -62 6)" />
        </g>
        <g className={flap ? "st-flap-r" : undefined} style={{ transformBox: "fill-box", transformOrigin: "0% 30%" }}>
          <ellipse cx={62} cy={6} rx={28} ry={16} fill="#7FB3E6" transform="rotate(25 62 6)" />
        </g>
        <ellipse cx={0} cy={0} rx={56} ry={60} fill="#9CC7F0" />
        <ellipse cx={0} cy={20} rx={34} ry={34} fill="#D7EBFB" />
        <path d="M-10 -66 q6 -20 14 -2 q8 -16 12 4" fill="#7FB3E6" />
        {[-18, 18].map((x) => (
          <g key={x} className="st-blink">
            <circle cx={x} cy={-16} r={14} fill="#fff" />
            <g style={{ transform: `translateX(${gaze * 4}px)`, transition: EASE }}>
              <circle cx={x + 2} cy={-14} r={8} fill={INK} />
              <circle cx={x + 5} cy={-18} r={3} fill="#fff" />
            </g>
          </g>
        ))}
        {expression === "worried" && <path d="M-30 -36 l18 6 M30 -36 l-18 6" stroke={INK} strokeWidth={4} strokeLinecap="round" />}
        <g className={beakClass} style={{ transformBox: "fill-box", transformOrigin: "50% 0%", transform: beakOpen ? "scaleY(1.6)" : undefined }}>
          <path d="M-10 4 L0 18 L10 4 Z" fill="#F0A33C" stroke="#C97C1F" strokeWidth={2} strokeLinejoin="round" />
        </g>
        <path d="M-10 4 L0 -4 L10 4 Z" fill="#F7B955" stroke="#C97C1F" strokeWidth={2} strokeLinejoin="round" />
      </g>
    </g>
  );
};

// ---------------------------------------------------------------------------

// Real-world sizes against the scenery: grown-ups stand about 510 of the
// 900-unit stage (a door or a bus is taller than them), children about
// three-quarters of a grown-up. Close-ups make faces big when it matters.
export const CHARACTER_SCALE: Record<StoryCharacterId, number> = { kai: 1.0, jaya: 0.96, amma: 1.06, papa: 1.1, maya: 1.06, asha: 1.04, pip: 1.0 };

// Roughly where each face is above the floor (stage units), for the camera.
export function faceHeight(id: StoryCharacterId, pose: StoryPose): number {
  const s = CHARACTER_SCALE[id];
  if (id === "pip") return 100 * s;
  const child = LOOKS[id].height === "child";
  const standing = (child ? 110 + 120 - 10 + 6 + 76 : 190 + 160 - 10 + 6 + 64) * s;
  const legLen = (child ? 110 : 190) * s;
  return pose === "sit" ? standing - legLen + SEAT_HEIGHT : standing;
}

export const StoryCharacter: React.FC<PoseProps & { id: StoryCharacterId }> = ({ id, look, ...pose }) =>
  id === "pip" ? <Pip {...pose} gaze={look} /> : <Person outfit={LOOKS[id]} gaze={look} {...pose} />;
