"""
PostgreSQL connection setup (SQLAlchemy). Used for structured, relational
data — condition module registry, routine steps, account metadata.
Firestore (see firestore.py) is used for more free-form / real-time data.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.POSTGRES_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
