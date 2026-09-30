from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class RoutineStep(BaseModel):
    child_id: str
    label: str
    order: int
    completed: bool = False


@router.get("/{child_id}")
async def get_routine(child_id: str):
    """
    Data-only feature — NEVER calls AI services (architecture spec section 6).
    If this file ever imports app.services.ai_services, that's a bug.
    """
    # STUB — fetch routine steps from storage.
    return {"child_id": child_id, "steps": []}


@router.post("/{child_id}/steps")
async def add_routine_step(child_id: str, step: RoutineStep):
    return {"status": "stub", "step": step}
