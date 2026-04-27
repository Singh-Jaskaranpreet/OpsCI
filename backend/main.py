from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import requests
from pathlib import Path
import json
from datetime import datetime, timedelta
import urllib3

#POUR DATABASE_Films
from database import engine, SessionLocal
from models import Base, Movie

Base.metadata.create_all(bind=engine)

# Désactiver warnings SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Charger .env
load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CONFIG
TMDB_TOKEN = os.getenv("TMDB_TOKEN", "").strip()
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500"

BASE_DIR = Path(__file__).parent
EXPORT_DIR = BASE_DIR / "exports"
EXPORT_DIR.mkdir(exist_ok=True)

# CACHE
cache_movies = []
cache_time = None
CACHE_DURATION = timedelta(minutes=10)


@app.get("/hello")
def hello():
    return {"message": "Hello World"}


# APPEL TMDB
def tmdb_get(path: str, params: dict | None = None) -> dict:
    if not TMDB_TOKEN:
        raise HTTPException(status_code=500, detail="TMDB_TOKEN manquant")

    url = f"{TMDB_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {TMDB_TOKEN}",
        "accept": "application/json"
    }

    try:
        r = requests.get(url, headers=headers, params=params, timeout=10, verify=False)

        if r.status_code == 401:
            raise HTTPException(status_code=401, detail="Clé API invalide")

        if r.status_code == 429:
            raise HTTPException(status_code=429, detail="Trop de requêtes (rate limit)")

        if r.status_code != 200:
            raise HTTPException(status_code=500, detail="Erreur TMDB")

        return r.json()

    except requests.exceptions.RequestException:
        raise HTTPException(status_code=500, detail="Erreur réseau")


# NORMALISATION
def normalize_tmdb_movie(m: dict) -> dict:
    poster_path = m.get("poster_path")
    image_url = f"{TMDB_IMG_BASE}{poster_path}" if poster_path else ""

    return {
        "title": m.get("title") or "Sans titre",
        "description": m.get("overview") or "",
        "image_url": image_url,
        "year": (m.get("release_date") or "")[:4],
        "tmdb_id": m.get("id"),
        "rating": m.get("vote_average")
    }


# ROUTE MOVIES (MAX 200)
@app.get("/movies")
def get_movies(limit: int = Query(default=50, ge=1, le=200)):
    db = SessionLocal()

    # 1. essayer DB
    movies = db.query(Movie).limit(limit).all()

    if movies:
        return [
            {
                "title": m.title,
                "description": m.description,
                "image_url": m.image_url,
                "year": m.year,
                "tmdb_id": m.tmdb_id,
                "rating": m.rating
            }
            for m in movies
        ]

    # 2. sinon appeler TMDB
    movies_data = []
    page = 1

    while len(movies_data) < limit:
        data = tmdb_get("/movie/popular", params={
            "language": "fr-FR",
            "page": page
        })

        results = data.get("results", [])

        for m in results:
            movie = normalize_tmdb_movie(m)

            db_movie = Movie(
                tmdb_id=movie["tmdb_id"],
                title=movie["title"],
                description=movie["description"],
                image_url=movie["image_url"],
                year=movie["year"],
                rating=movie["rating"]
            )

            db.add(db_movie)
            db.commit()
            db.refresh(db_movie)

            movies_data.append({
                "title": db_movie.title,
                "description": db_movie.description,
                "image_url": db_movie.image_url,
                "year": db_movie.year,
                "tmdb_id": db_movie.tmdb_id,
                "rating": db_movie.rating
            })

        page += 1

        if page > 5:
            break

    return movies_data[:limit]

# EXPORT JSON
@app.get("/export/movies.json")
def export_movies(limit: int = Query(default=100, ge=1, le=200)):
    movies = []
    page = 1

    while len(movies) < limit:
        data = tmdb_get("/movie/popular", params={
            "language": "fr-FR",
            "page": page
        })

        results = data.get("results", [])

        if not results:
            break

        movies.extend([normalize_tmdb_movie(m) for m in results])
        page += 1

        if page > 10:
            break

    movies = movies[:limit]

    filename = f"movies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = EXPORT_DIR / filename

    filepath.write_text(json.dumps(movies, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "file": filename,
        "count": len(movies)
    }




#trendings 
@app.get("/movies/trending")
def get_trending(limit: int = Query(default=20, ge=1, le=100)):
    data = tmdb_get("/trending/movie/week", params={"language": "fr-FR"})
    results = data.get("results", [])

    movies = [normalize_tmdb_movie(m) for m in results]

    return movies[:limit]


#trailers 
@app.get("/movies/{movie_id}/trailer")
def get_trailer(movie_id: int):
    data = tmdb_get(f"/movie/{movie_id}/videos")

    results = data.get("results", [])

    for video in results:
        if video["type"] == "Trailer" and video["site"] == "YouTube":
            return {
                "url": f"https://www.youtube.com/watch?v={video['key']}"
            }

    return {"url": None}