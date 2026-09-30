from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class AIRequest(BaseModel):
    child_id: str
    feature: str  # "journaling" | "stories" | "emergency" — never "routines"
    payload: dict


@router.post("/route")
async def route_ai_request(request: AIRequest):
    """
    Central AI routing point.

    Per architecture spec section 6 / section 8 item 6: Routines never needs
    AI, so this endpoint rejects any request from that feature as the safer
    default, rather than assuming upstream code will never send one.
    """
    if request.feature == "routines":
        return {
            "status": "error",
            "message": "Routines never calls AI services — see docs/Architecture_Specification.md section 6.",
        }

    # STUB — dispatch to app/services/ai_services.py based on request.feature.
    return {"status": "stub", "feature": request.feature}
