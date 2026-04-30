import time
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

engine = None

# THIS is what prevents container crash
for i in range(10):
    try:
        engine = create_engine(DATABASE_URL)
        conn = engine.connect()
        conn.close()
        print("✅ DB connected")
        break
    except Exception as e:
        print(f"DB not ready (attempt {i})")
        time.sleep(2)

if engine is None:
    raise Exception("Could not connect to DB")

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

def init_db():
    Base.metadata.create_all(bind=engine)