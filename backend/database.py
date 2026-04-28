# gestion de la connexion a postgres

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# adapte si besoin (password / port / nom db)
DATABASE_URL = "postgresql://postgres:password@localhost:5432/movies_db"

engine = create_engine(DATABASE_URL)

# session pour parler a la DB
SessionLocal = sessionmaker(bind=engine)

# base pour les models
Base = declarative_base()