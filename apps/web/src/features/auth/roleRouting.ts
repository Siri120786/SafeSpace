// apps/web/src/features/auth/roleRouting.ts
// Who may open which route (docs/role-flow/CONTRACT.md section 3). Pure, so
// every combination is unit-tested (apps/web/tests/role-routing.test.mts);
// RoleRoute and GuestRoute only render what this decides.

import {
  ROLE_HOME_ROUTES,
  USER_ROLE_TO_APP_ROLE,
  type AppRole,
  type AppSession,
} from "@safespace/shared-types";

export const ONBOARDING_PATH = "/onboarding";
export const LOGIN_PATH = "/login";
export const CHILD_SIGN_IN_PATH = "/child/pin";

export function roleOf(session: AppSession): AppRole | null {
  if (!session) return null;
  if (session.kind === "child") return "child";
  if (session.kind === "auth_user") return USER_ROLE_TO_APP_ROLE[session.profile.role] ?? null;
  return null;
}

export function homeFor(role: AppRole): string {
  return ROLE_HOME_ROUTES[role];
}

// Where a signed-in visitor belongs right now: onboarding first for adults
// who haven't finished it, otherwise their role's home.
export function landingFor(session: AppSession): string | null {
  const role = roleOf(session);
  if (!role) return null;
  if (session?.kind === "auth_user" && session.profile.onboardingState === "pending") return ONBOARDING_PATH;
  return homeFor(role);
}

export type RouteDecision = { kind: "allow" } | { kind: "redirect"; to: string };

// allow: the roles this route is for. path: the route being opened.
export function decideRoute(session: AppSession, allow: AppRole[], path: string): RouteDecision {
  const role = roleOf(session);
  if (!role) {
    // Signed out: children sign in with the family code and PIN, adults by email.
    return { kind: "redirect", to: allow.length === 1 && allow[0] === "child" ? CHILD_SIGN_IN_PATH : LOGIN_PATH };
  }
  if (session?.kind === "auth_user") {
    const onOnboarding = path === ONBOARDING_PATH;
    if (session.profile.onboardingState === "pending" && !onOnboarding) return { kind: "redirect", to: ONBOARDING_PATH };
    if (session.profile.onboardingState === "completed" && onOnboarding) return { kind: "redirect", to: homeFor(role) };
  }
  if (!allow.includes(role)) return { kind: "redirect", to: homeFor(role) };
  return { kind: "allow" };
}

// /login?as=... and /signup?as=... : the role the visitor picked, if valid.
export function chosenRole(search: string): "individual" | "caregiver" | null {
  const as = new URLSearchParams(search).get("as");
  return as === "individual" || as === "caregiver" ? as : null;
}
