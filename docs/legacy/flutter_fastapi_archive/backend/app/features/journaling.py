from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class JournalEntry(BaseModel):
    child_id: str
    module: str  # which condition module frames this entry, e.g. "anxiety" -> "safe journaling"
    audio_url: Optional[str] = None
    text: Optional[str] = None


@router.post("/entries")
async def create_journal_entry(entry: JournalEntry):
    """
    Calls AI services (speech-to-text if audio, then NLP for sentiment /
    safety flags) BEFORE saving. One of only two shared features (with
    Stories) that call AI ahead of a storage write — see architecture spec
    section 6.
    """
    # STUB — call STT if entry.audio_url is set, then NLP flagging, then save.
    return {"status": "stub", "flagged_for_safety_review": False}
