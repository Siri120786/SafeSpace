import React from "react";

// SafeSpace's mascot: the puppy from the landing page's meadow (the boy and
// his puppy lying on the sunny hill), in a soft round frame. It replaced the
// old brain drawing; the name and props stay the same so every page that
// shows the mascot gets the puppy. `stance` only changes the gentle tilt.

const PUPPY = new URL("./puppy.webp", import.meta.url).href;

interface Props {
  stance?: "happy" | "meditating" | "peeking" | "waving" | "celebrating";
  className?: string;
  showBubble?: boolean;
  bubbleText?: string;
  size?: number | string;
}

const TILT: Record<NonNullable<Props["stance"]>, string> = {
  happy: "rotate(0deg)",
  meditating: "rotate(0deg)",
  peeking: "rotate(-4deg)",
  waving: "rotate(3deg)",
  celebrating: "rotate(-3deg)",
};

export const BrainMascot: React.FC<Props> = ({
  stance = "happy",
  className = "",
  showBubble = false,
  bubbleText = "How are you feeling today?",
  size = 180,
}) => {
  const px = typeof size === "number" ? `${size}px` : size;
  return (
    <div className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}>
      {showBubble && stance !== "peeking" && (
        <div className="absolute -top-12 z-20">
          <div className="relative bg-white text-[#2f5a30] font-semibold text-xs md:text-sm px-4 py-2 rounded-full shadow-[0_8px_20px_rgba(20,60,100,0.18)] whitespace-nowrap">
            <span>{bubbleText}</span>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
          </div>
        </div>
      )}
      <img
        src={PUPPY}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ width: px, height: px, transform: TILT[stance] }}
        className="rounded-full object-cover border-4 border-white shadow-[0_12px_30px_rgba(20,60,100,0.28)]"
      />
    </div>
  );
};

export default BrainMascot;
