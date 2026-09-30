from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

router = APIRouter()


class DistressSignal(BaseModel):
    child_id: str
    source: str  # "checkin" | "aac_tap" | "journal_flag"
    raw_context: Optional[str] = None


@router.post("/check")
async def safety_classifier_check(signal: DistressSignal):
    """
    Step 2 of the emergency escalation flow (architecture spec section 5).
    Deliberately NOT diagnostic — rule-based + lightweight NLP only. Its
    only job is "escalate or not," never "what's wrong with this person."
    """
    # STUB — replace with a real rule-based + NLP check.
    escalate = True
    return {"escalate": escalate, "checked_at": datetime.utcnow().isoformat()}


@router.post("/escalate")
async def escalate(signal: DistressSignal):
    """
    Steps 3-5: privacy override, AI-crafted alert, notify + log.

    This endpoint bypasses privacy-tier filtering UNCONDITIONALLY — the
    hard-override rule from architecture spec section 3. Every escalation
    here must also be logged for post-incident review, never for diagnosis.
    """
    # 1. Privacy override applied unconditionally (no tier check here — intentional).
    # 2. STUB — call AI orchestration to draft the alert summary.
    alert_summary = "STUB: AI-crafted summary would be generated here."
    # 3. STUB — notify caregiver / emergency contact.
    # 4. STUB — log event for post-incident review.
    return {"status": "escalated", "alert_summary": alert_summary, "logged": True}
