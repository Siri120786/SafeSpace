from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_session, privacy_tier_for_age
from app.core.config import settings
from app.modules import CONDITION_MODULES

router = APIRouter()


@router.get("/child/{child_id}")
async def get_child_modules(child_id: str, session: dict = Depends(get_current_session)):
    """
    User view load steps 2-3: returns the assigned module list.

    The client does a plain length check on this response (0 / 1 / 2+) to
    decide whether to show an empty state, open a module directly, or show
    the picker. That branching is a RENDERING choice only — it must never
    duplicate business logic that belongs here.
    """
    # STUB — replace with a real DB lookup.
    assigned = ["autism"]
    if not assigned:
        # See docs/Architecture_Specification.md section 8, item 1 — unresolved edge case.
        raise HTTPException(status_code=404, detail="No modules assigned to this child.")
    return {"child_id": child_id, "assigned_modules": assigned}


@router.get("/dashboard/{child_id}")
async def get_dashboard_data(
    child_id: str,
    days: int = settings.DASHBOARD_DEFAULT_WINDOW_DAYS,
    session: dict = Depends(get_current_session),
):
    """
    Caregiver dashboard load steps 3-4.

    IMPORTANT: the privacy tier is applied BEFORE the query runs, not after
    the data is fetched. This is the security-critical ordering rule from
    the architecture spec — never fetch raw data and filter it client-side.
    """
    child_age = 10  # STUB — fetch from DB
    tier = privacy_tier_for_age(child_age)

    # STUB — build the actual tier-filtered query here.
    return {
        "child_id": child_id,
        "privacy_tier": tier,
        "window_days": days,
        "aggregated_inputs": [],
    }


@router.get("/conditions")
async def list_condition_modules():
    """Returns the static registry of all six condition modules and their features."""
    return CONDITION_MODULES
