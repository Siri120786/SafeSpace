import { CONDITION_KEY } from "../lib/deviceStore";
import { sanitizeCondition, type Condition } from "../lib/condition";
import { useStoredState } from "./useStoredState";

/** Which label the person follows (PCOS, PCOD or not sure). Kept on this device only. */
export function useCondition() {
  return useStoredState<Condition | null>(CONDITION_KEY, null, sanitizeCondition);
}
