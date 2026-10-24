/**
 * Thrisha's wellness modules inside the child's space (role-flow 5b): child
 * paths, only the assigned modules, no caregiver story link, Cycle Care never
 * offered. Her adult defaults are covered by sprint3.test.mts. Run with:
 * tsx apps/web/tests/child-modules.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CalmSpace, ModulesHome, SafeHarbor } from "../src/features/wellness-modules/components/ModuleScreens.tsx";
import { childModuleKeys } from "../src/features/child-space/childHome.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const render = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(StaticRouter, { location: "/child/modules" }, el));
const child = {
  lowSensory: false,
  onExit: () => {},
  paths: { base: "/child/modules", calmTools: "/child/calm-tools" },
  showStoryWorkflow: false,
};

test("the child's module list links under /child/modules, only for assigned modules", () => {
  const html = render(React.createElement(ModulesHome, { ...child, onlyKeys: childModuleKeys(["anxiety", "ptsd", "pcos_pcod"]) }));
  assert.match(html, /href="\/child\/modules\/calm-space"/);
  assert.match(html, /href="\/child\/modules\/safe-harbor"/);
  assert.doesNotMatch(html, /bright-days/);
  assert.doesNotMatch(html, /cycle-care/);
  assert.doesNotMatch(html, /href="\/modules\//);
});

test("no caregiver stories link for a child", () => {
  const html = render(React.createElement(ModulesHome, { ...child, onlyKeys: ["anxiety"] }));
  assert.doesNotMatch(html, /story-workflow|caregiver\/stories/);
});

test("calm tool links stay inside the child's space", () => {
  for (const el of [CalmSpace, SafeHarbor]) {
    const html = render(React.createElement(el, child));
    assert.match(html, /href="\/child\/calm-tools\/(breathing|grounding)"/);
    assert.doesNotMatch(html, /href="\/calm-tools\//);
  }
});

console.log(`${passed} child-modules checks`);
