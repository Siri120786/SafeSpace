"""
Firestore client setup. Used for journal entries, mood/emotion logs, and
other semi-structured or real-time data that benefits from Firestore's
document model over a relational schema.
"""
from app.core.config import settings

# STUB — initialize the real client, e.g.:
# from google.cloud import firestore
# db = firestore.Client(project=settings.FIRESTORE_PROJECT_ID)

db = None  # placeholder until credentials are wired up
