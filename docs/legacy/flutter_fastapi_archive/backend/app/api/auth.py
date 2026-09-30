from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from typing import List

router = APIRouter()


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChildProfileRequest(BaseModel):
    name: str
    age: int
    assigned_modules: List[str]  # e.g. ["autism", "anxiety"]


class PinVerifyRequest(BaseModel):
    child_id: str
    pin: str


@router.post("/signup")
async def signup(payload: SignupRequest):
    """Creates a caregiver account via Firebase Auth. Stub — wire up firebase_admin."""
    return {"status": "stub", "message": "Caregiver account created", "email": payload.email}


@router.post("/login")
async def login(payload: LoginRequest):
    """Validates caregiver credentials, issues a session token. Stub."""
    return {"status": "stub", "session_token": "stub-token"}


@router.post("/children")
async def add_child_profile(payload: ChildProfileRequest):
    """
    Adds a child profile under the caregiver's account.

    Open design question (architecture spec section 8, item 1): should at
    least one assigned module be required here to avoid the zero-modules
    edge case downstream? Currently enforced as REQUIRED below — revisit
    if a legitimate "no modules yet" use case turns up.
    """
    if not payload.assigned_modules:
        return {"status": "error", "message": "At least one condition module must be assigned."}
    return {"status": "stub", "child_id": "stub-child-id", "modules": payload.assigned_modules}


@router.post("/children/pin-verify")
async def verify_pin(payload: PinVerifyRequest):
    """Verifies a child's PIN/pattern and opens a child session. Stub."""
    return {"status": "stub", "child_session_token": "stub-child-token"}
