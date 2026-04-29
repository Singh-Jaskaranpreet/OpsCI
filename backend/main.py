from fastapi import FastAPI, Query, HTTPException, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import requests
from pathlib import Path
import json
from datetime import datetime
load_dotenv()

from database import SessionLocal, init_db
from models import Movie, User, Favorite
from sqlalchemy.orm import Session

init_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
EXPORT_DIR = BASE_DIR / "exports"
EXPORT_DIR.mkdir(exist_ok=True)
RECOMMENDATION_URL = os.getenv("RECOMMENDATION_URL", "http://localhost:8001")

@app.get("/hello")
def hello():
    return {"message": "Hello World"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def serialize_movie(movie: Movie) -> dict:
    return {
        "id": movie.id,
        "title": movie.title,
        "description": movie.description,
        "image_url": movie.image_url,
        "year": movie.year,
        "tmdb_id": movie.tmdb_id,
        "rating": movie.rating,
        "genre": movie.genre,
        "trailer_url": movie.trailer_url
    }


def get_recommendations_from_service(user_id: int) -> dict:
    try:
        response = requests.post(f"{RECOMMENDATION_URL}/update/{user_id}", timeout=5)
        if response.status_code == 200:
            return response.json()
    except requests.RequestException as error:
        print(f"Erreur service recommendation: {error}")

    return {
        "status": "error",
        "cached": False,
        "recommendations": []
    }


# MOVIES
@app.get("/movies")
def get_movies(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str = "",
    genre: str = "",
    db: Session = Depends(get_db)
):
    query = db.query(Movie)

    if q:
        query = query.filter(Movie.title.ilike(f"%{q}%"))

    if genre:
        query = query.filter(Movie.genre.ilike(f"%{genre}%"))

    movies = query.offset(offset).limit(limit).all()
    return [serialize_movie(movie) for movie in movies]


@app.get("/movies/filters")
def get_movie_filters(db: Session = Depends(get_db)):
    movies = db.query(Movie.genre).all()
    genres = set()

    for (genre_text,) in movies:
        if genre_text:
            for genre in genre_text.split(","):
                cleaned = genre.strip()
                if cleaned:
                    genres.add(cleaned)

    return {
        "genres": sorted(genres)
    }


# EXPORT
@app.get("/export/movies.json")
def export_movies(
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    movies = db.query(Movie).limit(limit).all()
    data = [serialize_movie(movie) for movie in movies]

    filename = f"movies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = EXPORT_DIR / filename

    filepath.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "file": filename,
        "count": len(data)
    }


# TRENDING
@app.get("/movies/trending")
def get_trending(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    movies = db.query(Movie).order_by(Movie.rating.desc()).limit(limit).all()
    return [serialize_movie(movie) for movie in movies]


@app.get("/movies/{movie_id}")
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.tmdb_id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Film non trouvé")

    return serialize_movie(movie)


# TRAILER
@app.get("/movies/{movie_id}/trailer")
def get_trailer(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.tmdb_id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Film non trouvé")

    return {"url": movie.trailer_url}

@app.post("/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username, User.password == password).first()
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    # On renvoie l'ID en plus du pseudo !
    return {"status": "ok", "username": username, "user_id": user.id}

@app.post("/register")
def register(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="L'utilisateur existe déjà")
    
    new_user = User(username=username, password=password)
    db.add(new_user)
    db.commit()
    return {"status": "ok"}

# --- GESTION DES FAVORIS ---

@app.post("/favorites/add")
def add_favorite(
    username: str = Form(...), 
    movie_id: int = Form(...), 
    title: str = Form(...), 
    image_url: str = Form(...), 
    db: Session = Depends(get_db)
):
    # 1. Vérification de l'utilisateur
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # 2. Ajout aux favoris s'il n'existe pas déjà
    existing = db.query(Favorite).filter(
        Favorite.user_id == user.id, 
        Favorite.movie_id == movie_id
    ).first()

    if not existing:
        new_fav = Favorite(
            movie_id=movie_id, 
            title=title, 
            image_url=image_url, 
            user_id=user.id
        )
        db.add(new_fav)
        db.commit()

    return {
        "message": "Favori ajouté !", 
        "recommendations": get_recommendations_from_service(user.id).get("recommendations", [])
    }


@app.post("/favorites/remove")
def remove_favorite(
    username: str = Form(...),
    movie_id: int = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    favorite = db.query(Favorite).filter(
        Favorite.user_id == user.id,
        Favorite.movie_id == movie_id
    ).first()

    if favorite:
        db.delete(favorite)
        db.commit()

    return {
        "message": "Favori supprimé !",
        "recommendations": get_recommendations_from_service(user.id).get("recommendations", [])
    }


@app.get("/favorites/check")
def check_favorite(username: str, movie_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return {"is_favorite": False}
    
    exists = db.query(Favorite).filter_by(user_id=user.id, movie_id=movie_id).first()
    return {"is_favorite": exists is not None}

@app.get("/favorites/{username}")
def get_favorites(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return []

    favorites = []
    for favorite in user.favorites:
        movie = db.query(Movie).filter(Movie.tmdb_id == favorite.movie_id).first()
        if movie:
            data = serialize_movie(movie)
            data["movie_id"] = movie.tmdb_id
            favorites.append(data)
        else:
            favorites.append({
                "movie_id": favorite.movie_id,
                "title": favorite.title,
                "image_url": favorite.image_url,
                "year": None,
                "rating": None
            })

    return favorites


@app.get("/recommendations/{username}")
def get_reco(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    return {
        **get_recommendations_from_service(user.id)
    }
