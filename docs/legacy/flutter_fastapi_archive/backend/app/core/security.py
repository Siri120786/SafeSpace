"""
Session and privacy-tier logic.

Implements the "client renders, backend decides" rule from the architecture
spec. None of this logic should ever be duplicated on the Flutter client —
if you find yourself writing role or privacy checks in the app, that logic
has leaked out of this file and needs to move back here.
"""
from enum import Enum
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer_scheme = HTTPBearer()


class Role(str, Enum):
    CAREGIVER = "caregiver"
    CHILD = "child"


class PrivacyTier(str, Enum):
    FULL_VISIBILITY = "4_8"       # fully visible to caregiver
    PARTIAL_PRIVACY = "9_12"      # child can attach a private note
    PRIVATE_DEFAULT = "13_plus"   # future scope — not yet built


def privacy_tier_for_age(age: int) -> PrivacyTier:
    if age <= 8:
        return PrivacyTier.FULL_VISIBILITY
    if age <= 12:
        return PrivacyTier.PARTIAL_PRIVACY
    return PrivacyTier.PRIVATE_DEFAULT


async def get_current_session(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Validates the Firebase token and decodes the role claim.
    TODO: replace this stub with a real firebase_admin.auth.verify_id_token() call.
    """
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session token")

    # STUB — wire up real Firebase verification here.
    return {"uid": "stub-user-id", "role": Role.CAREGIVER, "child_id": None}


def require_role(required: Role):
    """Dependency factory — use as Depends(require_role(Role.CAREGIVER)) on a route."""
    async def _check(session: dict = Depends(get_current_session)) -> dict:
        if session["role"] != required:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires role: {required}")
        return session
    return _check
