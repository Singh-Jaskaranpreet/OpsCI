from fastapi import FastAPI, Query, HTTPException, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import os
import requests
from pathlib import Path
import json
from datetime import datetime, timedelta
import urllib3

from database import engine, SessionLocal
from models import Base, Movie, User, Favorite
from sqlalchemy.orm import Session


Base.metadata.create_all(bind=engine)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TMDB_TOKEN = os.getenv("TMDB_TOKEN", "").strip()
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500"

BASE_DIR = Path(__file__).parent
EXPORT_DIR = BASE_DIR / "exports"
EXPORT_DIR.mkdir(exist_ok=True)

# Utilise ".." pour dire : "sort du dossier backend et cherche frontend juste à côté"
templates = Jinja2Templates(directory="../frontend")
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

cache_movies = []
cache_time = None
CACHE_DURATION = timedelta(minutes=10)
templates = Jinja2Templates(directory="../frontend")

@app.get("/hello")
def hello():
    return {"message": "Hello World"}

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# TMDB
def tmdb_get(path: str, params: dict | None = None) -> dict:
    if not TMDB_TOKEN:
        raise HTTPException(status_code=500, detail="TMDB_TOKEN manquant")

    url = f"{TMDB_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {TMDB_TOKEN}",
        "accept": "application/json"
    }

    r = requests.get(url, headers=headers, params=params, timeout=10, verify=False)

    if r.status_code != 200:
        raise HTTPException(status_code=500, detail="Erreur TMDB")

    return r.json()


# NORMALIZE
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


# MOVIES
@app.get("/movies")
def get_movies(limit: int = 10, offset: int = 0):
    db = SessionLocal()

    total = db.query(Movie).count()

    # 🔥 remplir la DB si pas assez de films
    if total < 100:
        page = 1

        while page <= 10:  # ≈ 200 films
            data = tmdb_get("/movie/popular", params={
                "language": "fr-FR",
                "page": page
            })

            results = data.get("results", [])

            for m in results:
                movie = normalize_tmdb_movie(m)

                # éviter doublons
                exists = db.query(Movie).filter_by(tmdb_id=movie["tmdb_id"]).first()
                if exists:
                    continue

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
            page += 1

    # pagination
    movies = db.query(Movie).offset(offset).limit(limit).all()

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


# EXPORT
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


# TRENDING
@app.get("/movies/trending")
def get_trending(limit: int = Query(default=20, ge=1, le=100)):
    data = tmdb_get("/trending/movie/week", params={"language": "fr-FR"})
    results = data.get("results", [])

    movies = [normalize_tmdb_movie(m) for m in results]

    return movies[:limit]


# TRAILER
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

# --- ROUTES AUTH ---
@app.post("/register")
async def register(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    # Vérifie si l'utilisateur existe déjà
    user_exists = db.query(User).filter(User.username == username).first()
    if user_exists:
        # Redirige vers register avec un paramètre d'erreur si tu veux
        return RedirectResponse(url="/register?error=exists", status_code=303)
    
    # Création du nouvel utilisateur
    new_user = User(username=username, password=password)
    db.add(new_user)
    db.commit()
    print(f"Succès : Utilisateur {username} créé.")
    return RedirectResponse(url="/login", status_code=303)

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username, User.password == password).first()
    
    if not user:
        # Si pas trouvé, on renvoie une erreur 401 que ton JS attrapera
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    
    return {"status": "ok", "username": username}
# --- ROUTES FAVORIS ---
@app.post("/favorites/add")
async def add_fav(data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data['username']).first()
    if not user: return {"error": "User not found"}
    exists = db.query(Favorite).filter(Favorite.user_id == user.id, Favorite.movie_id == data['tmdb_id']).first()
    if not exists:
        db.add(Favorite(movie_id=data['tmdb_id'], title=data['title'], image_url=data['image_url'], user_id=user.id))
        db.commit()
    return {"status": "ok"}

@app.get("/api/favorites/{username}")
async def get_favs(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    return user.favorites if user else []

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    # On utilise les arguments nommés 'request' et 'name'
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/login", response_class=HTMLResponse)
async def s_login(request: Request):
    return templates.TemplateResponse(request=request, name="login.html")

@app.get("/register", response_class=HTMLResponse)
async def s_register(request: Request):
    return templates.TemplateResponse(request=request, name="register.html")

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse(request=request, name="dashboard.html")