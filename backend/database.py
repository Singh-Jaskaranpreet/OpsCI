import time
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@db:5432/opsci"
)

engine = None

# Retry connection (fix DB startup race)
for i in range(10):
    try:
        engine = create_engine(DATABASE_URL)
        conn = engine.connect()
        conn.close()
        print("✅ DB connected")
        break
    except Exception as e:
        print(f"⏳ DB not ready, retry {i}")
        time.sleep(2)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


def init_db():
    Base.metadata.create_all(bind=engine)