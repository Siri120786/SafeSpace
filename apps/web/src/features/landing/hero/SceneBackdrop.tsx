import React from "react";
import { SCENE_PLATE } from "./heroScene";

// The landing page's hillside, softly blurred behind a page (login, sign-up),
// so getting in feels like the same calm place. A still image only: nothing
// moves behind a form.
export const SceneBackdrop: React.FC = () => (
  <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-[#8fbde8]">
    <img
      src={SCENE_PLATE}
      alt=""
      decoding="async"
      className="absolute inset-0 h-full w-full scale-105 object-cover object-[30%_40%] blur-[6px]"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-sky-900/10 via-transparent to-emerald-950/25" />
  </div>
);

export default SceneBackdrop;
