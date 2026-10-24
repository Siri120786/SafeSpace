import { sanitizeCondition, type Condition } from "../lib/condition";
import { useCycleCarePart } from "./useCycleCarePart";

/** Which label the person follows (PCOS, PCOD or not sure). Saved to their account. */
export function useCondition() {
  return useCycleCarePart<Condition | null>("condition", null, sanitizeCondition);
}
