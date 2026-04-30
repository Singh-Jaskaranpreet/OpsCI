"""Shared fixtures for the recommendation-service test suite (SQLite in-memory)."""
import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

RECO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RECO_ROOT))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False)

import database  # noqa: E402
database.engine = TEST_ENGINE
database.SessionLocal = TestingSessionLocal

def _init_db_sqlite():
    database.Base.metadata.create_all(bind=TEST_ENGINE)

database.init_db = _init_db_sqlite

import recom  # noqa: E402  (must come AFTER the patch above)
from models import Movie, Favorite  # noqa: E402

database.Base.metadata.create_all(bind=TEST_ENGINE)


@pytest.fixture
def db():
    database.Base.metadata.drop_all(bind=TEST_ENGINE)
    database.Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seeded_db(db):
    """A DB pre-populated with a small movie catalogue."""
    db.add_all([
        Movie(tmdb_id=1, title="Alien",         rating=8.5, genre="Horror, Sci-Fi"),
        Movie(tmdb_id=2, title="Predator",      rating=7.8, genre="Action, Sci-Fi"),
        Movie(tmdb_id=3, title="Amelie",        rating=8.3, genre="Romance, Comedy"),
        Movie(tmdb_id=4, title="Terminator",    rating=8.0, genre="Action, Sci-Fi"),
        Movie(tmdb_id=5, title="Notting Hill",  rating=7.2, genre="Romance, Comedy"),
        Movie(tmdb_id=6, title="The Thing",     rating=8.2, genre="Horror, Sci-Fi"),
    ])
    db.commit()
    return db
