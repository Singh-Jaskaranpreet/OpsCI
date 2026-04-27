from sqlalchemy import Column, Integer, String, Float
from database import Base

class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    tmdb_id = Column(Integer, unique=True)
    title = Column(String)
    description = Column(String)
    image_url = Column(String)
    year = Column(String)
    rating = Column(Float)