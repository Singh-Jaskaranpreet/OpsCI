"""Shared fixtures for the backend test suite.

We force `DATABASE_URL` to an in-memory SQLite *before* importing the
application, so that `init_db()` (triggered at import time in `main.py`)
runs against SQLite instead of trying to reach a real PostgreSQL server.
"""
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ---- Make the backend package importable ---------------------------------
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# ---- Force SQLite BEFORE importing the app --------------------------------
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["RECOMMENDATION_URL"] = "http://reco-mock:9999"  # never actually called

# Build a single shared in-memory engine (StaticPool keeps the same connection)
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False)

# Patch database module so app uses our engine/session
import database  # noqa: E402
database.engine = TEST_ENGINE
database.SessionLocal = TestingSessionLocal

# Re-point init_db to use our engine AND tolerate SQLite (skip PG-specific DDL)
def _init_db_sqlite():
    database.Base.metadata.create_all(bind=TEST_ENGINE)

database.init_db = _init_db_sqlite

# Now safe to import the app
import main  # noqa: E402
from models import Movie  # noqa: E402

# Make sure tables exist
database.Base.metadata.create_all(bind=TEST_ENGINE)


# ---- Stub the recommendation service HTTP call ---------------------------
@pytest.fixture(autouse=True)
def _stub_reco(monkeypatch):
    """Neutralise outgoing calls to the recommendation service."""
    def _fake(*_args, **_kwargs):
        return {"status": "ok", "cached": False, "recommendations": []}
    monkeypatch.setattr(main, "get_recommendations_from_service", _fake)


# ---- Fresh DB per test ---------------------------------------------------
@pytest.fixture(autouse=True)
def _reset_db():
    database.Base.metadata.drop_all(bind=TEST_ENGINE)
    database.Base.metadata.create_all(bind=TEST_ENGINE)
    # Seed a few movies for tests that need them
    with TestingSessionLocal() as db:
        db.add_all([
            Movie(tmdb_id=101, title="Inception", description="Dream heist",
                  image_url="/p/inception.jpg", year="2010", rating=8.8,
                  genre="Action, Sci-Fi", trailer_url="https://youtu.be/INC"),
            Movie(tmdb_id=102, title="The Matrix", description="Red pill",
                  image_url="/p/matrix.jpg", year="1999", rating=8.7,
                  genre="Action, Sci-Fi", trailer_url="https://youtu.be/MTX"),
            Movie(tmdb_id=103, title="Amelie", description="Parisian girl",
                  image_url="/p/amelie.jpg", year="2001", rating=8.3,
                  genre="Romance, Comedy", trailer_url="https://youtu.be/AML"),
        ])
        db.commit()
    yield


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c
