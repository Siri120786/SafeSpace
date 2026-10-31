// The calm plan's rules on the web (the same as the focus-tools function's,
// supabase/functions/_shared/calmPlan.ts): four lists of up to 10 short items.

export type CalmPlanList = "signs" | "helps" | "people" | "places";
export type CalmPlan = Record<CalmPlanList, string[]>;

export const CALM_PLAN_LISTS: readonly CalmPlanList[] = ["signs", "helps", "people", "places"];
export const MAX_ITEMS = 10;
export const MAX_LENGTH = 120;
export const EMPTY_PLAN: CalmPlan = { signs: [], helps: [], people: [], places: [] };

export type PlanResult = { ok: true; plan: CalmPlan } | { ok: false; error: string };

export function addItem(plan: CalmPlan, list: CalmPlanList, text: string): PlanResult {
  const t = text.trim();
  if (!t) return { ok: false, error: "Please write something first." };
  if (t.length > MAX_LENGTH) return { ok: false, error: `Please keep it under ${MAX_LENGTH} characters.` };
  if (plan[list].length >= MAX_ITEMS) return { ok: false, error: "That list is full. Remove one to add another." };
  if (plan[list].some((x) => x.toLowerCase() === t.toLowerCase())) return { ok: false, error: "That's already on your plan." };
  return { ok: true, plan: { ...plan, [list]: [...plan[list], t] } };
}

export function removeItem(plan: CalmPlan, list: CalmPlanList, index: number): CalmPlan {
  return { ...plan, [list]: plan[list].filter((_, i) => i !== index) };
}

/** Whatever came back from the account (or nothing), as a safe plan. */
export function sanitizePlan(raw: unknown): CalmPlan {
  if (!raw || typeof raw !== "object") return EMPTY_PLAN;
  const r = raw as Record<string, unknown>;
  const out: CalmPlan = { signs: [], helps: [], people: [], places: [] };
  for (const list of CALM_PLAN_LISTS) {
    for (const item of Array.isArray(r[list]) ? (r[list] as unknown[]) : []) {
      if (typeof item !== "string") continue;
      const res = addItem(out, list, item);
      if (res.ok) out[list] = res.plan[list];
    }
  }
  return out;
}

export const planIsEmpty = (p: CalmPlan) => CALM_PLAN_LISTS.every((l) => p[l].length === 0);
