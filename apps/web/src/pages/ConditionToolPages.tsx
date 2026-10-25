import React from "react";
import { useParams } from "react-router-dom";
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
import { ThemedFrame, ThemedToolsHome, ToolThemePicker, useAppTheme, useSupportAreas, type ThemeToolItem } from "../features/themes";
import type { ConditionTool } from "../features/conditions/conditionTools";
import "../features/themes/space/space.css";
import "../features/themes/animals/animals.css";
import "../features/themes/ocean/ocean-theme.css";
import "../features/themes/nature/nature.css";
import "../features/themes/calm/calm.css";
import "../features/conditions/anxiety/ocean/ocean.css";

// The ADHD and autism tools (role-flow 8c): a list page ("Your tools", then
// "More tools") and one page per tool, for children and for Individuals.
// Each shows in the person's theme (calm when low-sensory mode is on, or
// without the ADHD or autism module).

const themedItems = (mine: ConditionTool[], more: ConditionTool[]): ThemeToolItem[] => [
  ...mine.map((tool) => ({ tool, mine: true })),
  ...more.map((tool) => ({ tool, mine: false })),
];

// The theme picker, for people who may choose (a child unless a caregiver
// locked their theme).
function useThemePicker() {
  const theme = useAppTheme();
  const themed = theme.active !== "plain";
  const picker = theme.canChoose ? (
    <ToolThemePicker look={themed ? "bold" : "plain"} value={theme.chosen} onChange={theme.choose} lowSensory={theme.lowSensory} />
  ) : null;
  return { active: theme.active, themed, picker };
}

// /child/tools
export const ChildConditionToolsPage: React.FC = () => {
  const { child } = useChildSpace();
  const { mine, more } = splitConditionTools(child.assignedModules);
  const { active, themed, picker } = useThemePicker();
  if (active !== "plain") {
    return (
      <ThemedToolsHome
        theme={active}
        items={themedItems(mine, more)}
        pathFor={childToolPath}
        eyebrow="My tools"
        backTo={ROUTES.CHILD_HOME}
        backLabel="Home"
        picker={picker}
      />
    );
  }
  return (
    <ChildPageShell title={mine.length ? "More tools" : "Tools"} backTo={ROUTES.CHILD_HOME}>
      {picker && <div className="rounded-3xl bg-white p-4 shadow-card">{picker}</div>}
      <ConditionToolList mine={mine} more={more} pathFor={childToolPath} tone="child" />
    </ChildPageShell>
  );
};

// /child/tools/:toolKey
export const ChildConditionToolPage: React.FC = () => {
  const { toolKey } = useParams();
  const { session, guard } = useChildSpace();
  const { active } = useAppTheme();
  const tool = findConditionTool(toolKey);
  if (tool && active !== "plain") {
    return (
      <ThemedFrame theme={active} eyebrow="My tools" title={tool.label} subtitle={tool.blurb} backTo={ROUTES.CHILD_TOOLS} backLabel="My tools">
        <ConditionToolView
          toolKey={tool.key}
          session={session}
          guard={guard}
          scheduleEmptyText="No routine steps for today. Your grown-up sets these up."
        />
      </ThemedFrame>
    );
  }
  if (!tool) {
    return (
      <ChildPageShell title="Tools" backTo={ROUTES.CHILD_TOOLS}>
        <p className="rounded-3xl bg-white p-5 shadow-card">That tool isn't here. Pick another one.</p>
      </ChildPageShell>
    );
  }
  return (
    <ChildPageShell title={tool.label} backTo={ROUTES.CHILD_HOME}>
      <ConditionToolView
        toolKey={tool.key}
        session={session}
        guard={guard}
        scheduleEmptyText="No routine steps for today. Your grown-up sets these up."
      />
    </ChildPageShell>
  );
};

// /tools
export const IndividualConditionToolsPage: React.FC = () => {
  const areas = useSupportAreas();
  const { mine, more } = splitConditionTools(areas ?? []);
  const { active, themed, picker } = useThemePicker();
  if (areas !== null && active !== "plain") {
    return (
      <ThemedToolsHome
        theme={active}
        items={themedItems(mine, more)}
        pathFor={individualToolPath}
        eyebrow="Focus and feelings tools"
        backTo={ROUTES.DASHBOARD}
        backLabel="Dashboard"
        picker={picker}
      />
    );
  }
  return (
    <MyToolsShell
      title="Focus and feelings tools"
      subtitle="Tools for your support areas come first. Everything else is under More tools."
      backTo={ROUTES.DASHBOARD}
      actions={picker}
    >
      {areas === null ? <p className="text-textBody">Loading...</p> : <ConditionToolList mine={mine} more={more} pathFor={individualToolPath} tone="adult" />}
    </MyToolsShell>
  );
};

// /tools/:toolKey
export const IndividualConditionToolPage: React.FC = () => {
  const { toolKey } = useParams();
  const { session } = useAuth();
  const tool = findConditionTool(toolKey);
  const { active } = useAppTheme();
  if (tool && active !== "plain") {
    return (
      <ThemedFrame theme={active} eyebrow="Focus and feelings tools" title={tool.label} subtitle={tool.blurb} backTo={ROUTES.TOOLS} backLabel="All tools">
        <ConditionToolView
          toolKey={tool.key}
          session={session}
          scheduleEmptyText="No routine steps for today. Set them up in My routines."
        />
      </ThemedFrame>
    );
  }
  return (
    <MyToolsShell title={tool?.label ?? "Tools"} subtitle={tool?.blurb} backTo={ROUTES.DASHBOARD}>
      {tool ? (
        <ConditionToolView
          toolKey={tool.key}
          session={session}
          scheduleEmptyText="No routine steps for today. Set them up in My routines."
        />
      ) : (
        <p className="text-textBody">That tool isn't here.</p>
      )}
    </MyToolsShell>
  );
};
