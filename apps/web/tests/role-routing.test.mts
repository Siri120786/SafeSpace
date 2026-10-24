/**
 * Role routing tests (docs/role-flow/CONTRACT.md section 3). Run with:
 * tsx apps/web/tests/role-routing.test.mts (part of `pnpm test`).
 * Every role against every route group, signed out, and mid-onboarding.
 */
import assert from "node:assert/strict";
import type { AppSession } from "@safespace/shared-types";
import {
  chosenRole,
  decideRoute,
  homeFor,
  landingFor,
  roleOf,
} from "../src/features/auth/roleRouting.ts";

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

const adult = (role: "user" | "caregiver", onboardingState: "pending" | "completed" = "completed"): AppSession => ({
  kind: "auth_user",
  user: { id: "u1", email: "x@example.test" },
  profile: { id: "u1", role, displayName: "X", onboardingState, createdAt: "", updatedAt: "" } as any,
  supabaseAccessToken: "t",
});
const individual = adult("user");
const caregiver = adult("caregiver");
const child: AppSession = { kind: "child", childSessionToken: "t", childId: "c1" };

const INDIVIDUAL = ["individual"] as const;
const CAREGIVER = ["caregiver"] as const;
const CHILD = ["child"] as const;
const ADULTS = ["individual", "caregiver"] as const;
const allow = (s: AppSession, a: readonly any[], path = "/x") => decideRoute(s, [...a], path);

test("roles: user is an Individual, caregiver a Caregiver, a child session a Child, none is null", () => {
  assert.equal(roleOf(individual), "individual");
  assert.equal(roleOf(caregiver), "caregiver");
  assert.equal(roleOf(child), "child");
  assert.equal(roleOf(null), null);
});

test("homes: /dashboard, /caregiver, /child", () => {
  assert.equal(homeFor("individual"), "/dashboard");
  assert.equal(homeFor("caregiver"), "/caregiver");
  assert.equal(homeFor("child"), "/child");
});

test("each role opens its own routes", () => {
  assert.deepEqual(allow(individual, INDIVIDUAL), { kind: "allow" });
  assert.deepEqual(allow(caregiver, CAREGIVER), { kind: "allow" });
  assert.deepEqual(allow(child, CHILD), { kind: "allow" });
  assert.deepEqual(allow(individual, ADULTS), { kind: "allow" });
  assert.deepEqual(allow(caregiver, ADULTS), { kind: "allow" });
});

test("each role is sent home from the others' routes", () => {
  assert.deepEqual(allow(individual, CAREGIVER), { kind: "redirect", to: "/dashboard" });
  assert.deepEqual(allow(individual, CHILD), { kind: "redirect", to: "/dashboard" });
  assert.deepEqual(allow(caregiver, INDIVIDUAL), { kind: "redirect", to: "/caregiver" });
  assert.deepEqual(allow(caregiver, CHILD), { kind: "redirect", to: "/caregiver" });
  assert.deepEqual(allow(child, INDIVIDUAL), { kind: "redirect", to: "/child" });
  assert.deepEqual(allow(child, CAREGIVER), { kind: "redirect", to: "/child" });
  assert.deepEqual(allow(child, ADULTS), { kind: "redirect", to: "/child" });
});

test("signed out: adult routes go to /login, child routes to the PIN page", () => {
  assert.deepEqual(allow(null, INDIVIDUAL), { kind: "redirect", to: "/login" });
  assert.deepEqual(allow(null, CAREGIVER), { kind: "redirect", to: "/login" });
  assert.deepEqual(allow(null, ADULTS), { kind: "redirect", to: "/login" });
  assert.deepEqual(allow(null, CHILD), { kind: "redirect", to: "/child/pin" });
});

test("adults who haven't finished onboarding go there first, whatever they open", () => {
  for (const role of ["user", "caregiver"] as const) {
    const s = adult(role, "pending");
    assert.deepEqual(allow(s, ADULTS), { kind: "redirect", to: "/onboarding" });
    assert.deepEqual(allow(s, CHILD), { kind: "redirect", to: "/onboarding" });
    assert.deepEqual(allow(s, ADULTS, "/onboarding"), { kind: "allow" });
  }
});

test("onboarding is closed once finished: back to the role's home", () => {
  assert.deepEqual(allow(individual, ADULTS, "/onboarding"), { kind: "redirect", to: "/dashboard" });
  assert.deepEqual(allow(caregiver, ADULTS, "/onboarding"), { kind: "redirect", to: "/caregiver" });
});

test("landing after sign-in: onboarding if pending, else the role's home", () => {
  assert.equal(landingFor(adult("caregiver", "pending")), "/onboarding");
  assert.equal(landingFor(caregiver), "/caregiver");
  assert.equal(landingFor(individual), "/dashboard");
  assert.equal(landingFor(child), "/child");
  assert.equal(landingFor(null), null);
});

test("?as= accepts only individual or caregiver", () => {
  assert.equal(chosenRole("?as=individual"), "individual");
  assert.equal(chosenRole("?as=caregiver"), "caregiver");
  assert.equal(chosenRole("?as=child"), null);
  assert.equal(chosenRole("?as=admin"), null);
  assert.equal(chosenRole(""), null);
});

console.log(`${passed} role-routing checks`);
