// supabase/functions/_shared/calmPlan.ts
// The shape of a Safe Harbor calm plan (migration 20261030200000): four short
// lists a person fills in for hard moments. Shared by the focus-tools
// function (children) and its tests; the web app keeps the same rules in
// apps/web/src/features/conditions/ptsd/harbor/calmPlan.ts.

export const CALM_PLAN_LISTS = ["signs", "helps", "people", "places"] as const;
export type CalmPlanList = (typeof CALM_PLAN_LISTS)[number];
export type CalmPlan = Record<CalmPlanList, string[]>;

export const CALM_PLAN_MAX_ITEMS = 10;
export const CALM_PLAN_MAX_LENGTH = 120;

export const EMPTY_CALM_PLAN: CalmPlan = { signs: [], helps: [], people: [], places: [] };

/** A valid plan, or null if anything in it breaks the rules. */
export function parseCalmPlan(raw: unknown): CalmPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (Object.keys(r).some((k) => !(CALM_PLAN_LISTS as readonly string[]).includes(k))) return null;
  const out: CalmPlan = { signs: [], helps: [], people: [], places: [] };
  for (const list of CALM_PLAN_LISTS) {
    const items = r[list] ?? [];
    if (!Array.isArray(items) || items.length > CALM_PLAN_MAX_ITEMS) return null;
    for (const item of items) {
      if (typeof item !== "string") return null;
      const t = item.trim();
      if (!t || t.length > CALM_PLAN_MAX_LENGTH) return null;
      out[list].push(t);
    }
  }
  return out;
}
