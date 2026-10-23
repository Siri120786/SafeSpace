// packages/api-client/src/childCaregivers.ts
// Several caregivers per child (docs/role-flow/CONTRACT.md section 4).
// Everything goes through the SECURITY DEFINER functions in
// 20261027000000_child_caregivers.sql; clients have no direct access to
// child_caregivers or caregiver_invites. Errors are ContractErrors whose
// message is the contract code (not_found, not_primary_caregiver,
// invite_invalid, already_caregiver, not_a_caregiver, rate_limited,
// invalid_input).

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, toContractError } from "./edge";
import {
  CAREGIVER_INVITE_CODE_LENGTH,
  type CaregiverInvite,
  type ChildCaregiver,
  type ChildCaregiverRole,
} from "@safespace/shared-types";

const INVITE_CODE_RE = new RegExp(`^[A-Z0-9]{${CAREGIVER_INVITE_CODE_LENGTH}}$`);

// Case-insensitive; spaces and dashes are ignored, matching the database.
export function normaliseInviteCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export async function listChildCaregivers(childId: string): Promise<ChildCaregiver[]> {
  const { data, error } = await getSafeSpaceClient().rpc("list_child_caregivers", { p_child_id: childId });
  if (error) throw toContractError(error);
  return (data ?? []).map((r: { caregiver_id: string; display_name: string | null; role: ChildCaregiverRole; added_at: string }) => ({
    caregiverId: r.caregiver_id,
    displayName: r.display_name,
    role: r.role,
    addedAt: r.added_at,
  }));
}

// Primary caregiver only. The code is shown once and never stored readably.
export async function createCaregiverInvite(childId: string): Promise<CaregiverInvite> {
  const { data, error } = await getSafeSpaceClient().rpc("create_caregiver_invite", { p_child_id: childId });
  if (error) throw toContractError(error);
  const row = (data ?? [])[0] as { code: string; expires_at: string } | undefined;
  if (!row) throw new ContractError("unknown_error");
  return { code: row.code, childId, expiresAt: row.expires_at };
}

// Returns the id of the child the caller now cares for.
export async function acceptCaregiverInvite(code: string): Promise<string> {
  const clean = normaliseInviteCode(code);
  if (!INVITE_CODE_RE.test(clean)) throw new ContractError("invite_invalid");
  const { data, error } = await getSafeSpaceClient().rpc("accept_caregiver_invite", { p_code: clean });
  if (error) throw toContractError(error);
  return data as string;
}

// The primary removes a co-caregiver; a co-caregiver passes their own id to leave.
export async function removeChildCaregiver(childId: string, caregiverId: string): Promise<void> {
  const { error } = await getSafeSpaceClient().rpc("remove_child_caregiver", {
    p_child_id: childId,
    p_caregiver_id: caregiverId,
  });
  if (error) throw toContractError(error);
}

// The family code the child signs in with (the primary caregiver's).
export async function getChildFamilyCode(childId: string): Promise<string> {
  const { data, error } = await getSafeSpaceClient().rpc("child_family_code", { p_child_id: childId });
  if (error) throw toContractError(error);
  if (!data) throw new ContractError("not_found");
  return data as string;
}
