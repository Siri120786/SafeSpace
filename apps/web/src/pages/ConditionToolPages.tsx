import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSupportPreferences } from "@safespace/api-client";
import type { ModuleKey } from "@safespace/shared-types";
import { ChildPageShell, useChildSpace } from "../features/child-space";
import { MyToolsShell } from "../features/my-tools";
import { useAuth } from "../features/auth";
import {
  ConditionToolList,
  ConditionToolView,
  childToolPath,
  findConditionTool,
  individualToolPath,
  splitConditionTools,
} from "../features/conditions";
import { ROUTES } from "../routes";

// The ADHD and autism tools (role-flow 8c): a list page ("Your tools", then
// "More tools") and one page per tool, for children and for Individuals.

// /child/tools
export const ChildConditionToolsPage: React.FC = () => {
  const { child } = useChildSpace();
  const { mine, more } = splitConditionTools(child.assignedModules);
  return (
    <ChildPageShell title={mine.length ? "More tools" : "Tools"} backTo={ROUTES.CHILD_HOME}>
      <ConditionToolList mine={mine} more={more} pathFor={childToolPath} tone="child" />
    </ChildPageShell>
  );
};

// /child/tools/:toolKey
export const ChildConditionToolPage: React.FC = () => {
  const { toolKey } = useParams();
  const tool = findConditionTool(toolKey);
  if (!tool) {
    return (
      <ChildPageShell title="Tools" backTo={ROUTES.CHILD_TOOLS}>
        <p className="rounded-3xl bg-white p-5 shadow-card">That tool isn't here. Pick another one.</p>
      </ChildPageShell>
    );
  }
  return (
    <ChildPageShell title={tool.label} backTo={ROUTES.CHILD_HOME}>
      <ConditionToolView toolKey={tool.key} />
    </ChildPageShell>
  );
};

// An Individual's chosen support areas (their modules).
function useMySupportAreas(): ModuleKey[] | null {
  const { session } = useAuth();
  const profileId = session?.kind === "auth_user" ? session.profile.id : null;
  const [areas, setAreas] = useState<ModuleKey[] | null>(null);
  useEffect(() => {
    if (!profileId) return;
    let live = true;
    getSupportPreferences(profileId)
      .then((p) => live && setAreas(p?.supportAreas ?? []))
      .catch(() => live && setAreas([]));
    return () => {
      live = false;
    };
  }, [profileId]);
  return areas;
}

// /tools
export const IndividualConditionToolsPage: React.FC = () => {
  const areas = useMySupportAreas();
  const { mine, more } = splitConditionTools(areas ?? []);
  return (
    <MyToolsShell
      title="Focus and feelings tools"
      subtitle="Tools for your support areas come first. Everything else is under More tools."
      backTo={ROUTES.DASHBOARD}
    >
      {areas === null ? <p className="text-textBody">Loading...</p> : <ConditionToolList mine={mine} more={more} pathFor={individualToolPath} tone="adult" />}
    </MyToolsShell>
  );
};

// /tools/:toolKey
export const IndividualConditionToolPage: React.FC = () => {
  const { toolKey } = useParams();
  const tool = findConditionTool(toolKey);
  return (
    <MyToolsShell title={tool?.label ?? "Tools"} subtitle={tool?.blurb} backTo={ROUTES.DASHBOARD}>
      {tool ? <ConditionToolView toolKey={tool.key} /> : <p className="text-textBody">That tool isn't here.</p>}
    </MyToolsShell>
  );
};
