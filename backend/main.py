from fastapi import FastAPI, Depends, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, SessionLocal
from models import Base, Movie, User, Favorite

app = FastAPI()

# 🔥 CORS FIX
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- MOVIES ----------------
@app.get("/movies")
def get_movies(limit: int = 10, offset: int = 0, db: Session = Depends(get_db)):
    movies = db.query(Movie).offset(offset).limit(limit).all()

    return [
        {
            "title": m.title,
            "description": m.description,
            "image_url": m.image_url,
            "year": m.year,
            "tmdb_id": m.tmdb_id,
            "rating": m.rating,
            "trailer_url": m.trailer_url  # 🔥 FIX
        }
        for m in movies
    ]


# ---------------- SEARCH ----------------
@app.get("/search")
def search(query: str, db: Session = Depends(get_db)):
    return db.query(Movie).filter(Movie.title.ilike(f"%{query}%")).all()


# ---------------- AUTH ----------------
@app.post("/register")
def register(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="user exists")

    db.add(User(username=username, password=password))
    db.commit()

    return {"status": "created"}


@app.post("/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.username == username,
        User.password == password
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="wrong credentials")

    return {"status": "ok", "username": username}


# ---------------- FAVORITES ----------------
@app.post("/favorites/add")
def add_fav(data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data['username']).first()

    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    exists = db.query(Favorite).filter(
        Favorite.user_id == user.id,
        Favorite.movie_id == data['tmdb_id']
    ).first()

    if not exists:
        db.add(Favorite(
            movie_id=data['tmdb_id'],
            title=data['title'],
            image_url=data['image_url'],
            user_id=user.id
        ))
        db.commit()

    return {"status": "ok"}


@app.get("/api/favorites/{username}")
def get_favs(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    return user.favorites if user else []