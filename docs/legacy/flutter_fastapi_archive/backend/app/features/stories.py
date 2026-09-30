from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class StoryRequest(BaseModel):
    child_id: str
    topic: str
    output_type: str = "text"  # "text" | "image" | "video"


@router.post("/generate")
async def generate_story(request: StoryRequest):
    """
    Calls the LLM to PRODUCE content, then saves the result — unlike
    Journaling, where AI processes input that already exists. See
    architecture spec section 6 for this distinction.
    """
    # STUB — call AI orchestration -> LLM, then save the generated story.
    return {"status": "stub", "story_id": "stub-story-id", "output_type": request.output_type}
