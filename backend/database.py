# gestion de la connexion a postgres
from os import getenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# adapte si besoin (password / port / nom db)
DATABASE_URL = getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost:5432/movies_db"
)

engine = create_engine(DATABASE_URL)

# session pour parler a la DB
SessionLocal = sessionmaker(bind=engine)

# base pour les models
Base = declarative_base()


def init_db():
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE movies ADD COLUMN IF NOT EXISTS genre VARCHAR"))
        connection.execute(text("ALTER TABLE movies ADD COLUMN IF NOT EXISTS trailer_url VARCHAR"))
