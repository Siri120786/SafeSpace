// supabase/functions/_shared/childSharing.ts
// Age and the age-15 sharing rule (docs/role-flow/CONTRACT.md section 5).
// Mirrors child_age_years() and child_sharing_status() in
// 20261027100000_child_birth_and_sharing.sql and the api-client copy in
// packages/api-client/src/childSharing.ts; a parity test keeps all three equal.
// Dates are UTC, like the database's current_date on the hosted project.

export const CAREGIVER_VISIBILITY_AGE = 15;
export const CHILD_MIN_AGE = 4;
export const CHILD_MAX_AGE = 17;

export type ChildSharingStatus = "under_15" | "not_asked" | "shared" | "not_shared";

// Whole years from the 1st of the birth month to `on`.
export function childAgeYears(birthYear: number, birthMonth: number, on: Date = new Date()): number {
  const months = on.getUTCFullYear() * 12 + (on.getUTCMonth() + 1) - (birthYear * 12 + birthMonth);
  return Math.trunc(months / 12);
}

export function childSharingStatus(ageYears: number, sharesWithCaregiver: boolean | null): ChildSharingStatus {
  if (ageYears < CAREGIVER_VISIBILITY_AGE) return "under_15";
  if (sharesWithCaregiver === null) return "not_asked";
  return sharesWithCaregiver ? "shared" : "not_shared";
}

// A birth month/year a caregiver may enter: a real month, not in the future,
// and an age of 4 to 17 today.
export function isValidChildBirth(birthYear: unknown, birthMonth: unknown, on: Date = new Date()): boolean {
  if (typeof birthYear !== "number" || typeof birthMonth !== "number") return false;
  if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) return false;
  if (birthYear * 12 + birthMonth > on.getUTCFullYear() * 12 + on.getUTCMonth() + 1) return false;
  const age = childAgeYears(birthYear, birthMonth, on);
  return age >= CHILD_MIN_AGE && age <= CHILD_MAX_AGE;
}
