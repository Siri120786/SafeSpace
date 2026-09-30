from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, modules, ai_orchestration
from app.features import journaling, routines, stories, emergency
from app.core.config import settings

app = FastAPI(
    title="SafeSpace API",
    description="Backend for the SafeSpace / Pathways digital mental health support platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Application layer — Auth service, Modules API, AI orchestration
app.include_router(auth.router, prefix="/auth", tags=["Auth service"])
app.include_router(modules.router, prefix="/modules", tags=["Modules API"])
app.include_router(ai_orchestration.router, prefix="/ai", tags=["AI orchestration"])

# Shared feature modules — used by all six condition modules
app.include_router(journaling.router, prefix="/features/journaling", tags=["Shared: Journaling"])
app.include_router(routines.router, prefix="/features/routines", tags=["Shared: Routines"])
app.include_router(stories.router, prefix="/features/stories", tags=["Shared: Stories"])
app.include_router(emergency.router, prefix="/features/emergency", tags=["Shared: Emergency"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "safespace-api"}
