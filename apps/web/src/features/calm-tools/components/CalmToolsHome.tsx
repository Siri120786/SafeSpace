import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { CalmToolShell } from "./CalmToolShell";

interface CalmToolsHomeProps {
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
  basePath?: string;   // where the calm tools are mounted (/calm-tools or /child/calm-tools)
}

const linkClass = "block rounded-3xl focus:outline-none focus:ring-2 focus:ring-olive-500 focus:ring-offset-2";

export const CalmToolsHome: React.FC<CalmToolsHomeProps> = ({ lowSensory, onExit, notice, basePath = "/calm-tools" }) => (
  <CalmToolShell title="Calm tools" onExit={onExit} lowSensory={lowSensory} notice={notice}>
    <div className="space-y-4">
      <p className="text-sm text-textBody">Pick something gentle to do. There is no sound, and you can leave at any time.</p>
      <Link to={`${basePath}/breathing`} className={linkClass}>
        <Card hoverable className="space-y-1">
          <h2 className="font-display text-xl text-textHeading">Breathing exercise</h2>
          <p className="text-sm text-textBody">About 2 minutes. Slow breathing with clear written steps.</p>
        </Card>
      </Link>
      <Link to={`${basePath}/grounding`} className={linkClass}>
        <Card hoverable className="space-y-1">
          <h2 className="font-display text-xl text-textHeading">5-4-3-2-1 grounding</h2>
          <p className="text-sm text-textBody">Use your five senses to come back to the present.</p>
        </Card>
      </Link>
    </div>
  </CalmToolShell>
);
