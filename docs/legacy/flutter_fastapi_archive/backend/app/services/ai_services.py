"""
Thin wrappers around external AI providers (NLP, LLM, speech-to-text).

Kept separate from app/api/ai_orchestration.py so the routing/governance
logic and the actual provider calls can be tested independently.
"""


async def transcribe_speech(audio_url: str) -> str:
    """STUB — wire up a real speech-to-text provider."""
    raise NotImplementedError


async def analyze_sentiment(text: str) -> dict:
    """STUB — wire up NLP sentiment / safety-flag analysis."""
    raise NotImplementedError


async def generate_content(prompt: str, output_type: str = "text") -> str:
    """STUB — wire up LLM generation for Social Stories and Emergency alerts."""
    raise NotImplementedError
