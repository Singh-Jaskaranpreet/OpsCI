import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_ # Indispensable pour le multi-genre
from dotenv import load_dotenv

# Importations locales
from database import SessionLocal
from models import Favorite, Movie 

load_dotenv()

app = FastAPI(title="SinghFlix AI Recommendation - Multi-Genre Mode")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Autorise tous les ports (8000, 5500, etc.)
    allow_credentials=True,
    allow_methods=["*"],  # Autorise POST, GET, etc.
    allow_headers=["*"],
)

# --- DÉPENDANCE BDD ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- HELPER FORMATAGE ---
def format_movie(movie, info=""):
    return {
        "id": movie.id,
        "title": movie.title,
        "poster_path": movie.image_url,
        "vote_average": movie.rating,
        "genres": movie.genre, # Affiche la liste des genres (ex: "Action, Drame")
        "info": info
    }

# --- ROUTE PRINCIPALE ---

@app.post("/update/{user_id}")
def update_recommendations(user_id: int, db: Session = Depends(get_db)):
    # 1. Récupérer tous les favoris
    favs = db.query(Favorite).filter(Favorite.user_id == user_id).all()
    
    if not favs:
        # Fallback si pas de favoris : on renvoie les mieux notés
        top_movies = db.query(Movie).order_by(Movie.rating.desc()).limit(6).all()
        return {"status": "success", "recommendations": [format_movie(m) for m in top_movies]}

    # 2. ANALYSE DES GENRES PRÉFÉRÉS
    all_genres = []
    fav_ids = []
    for f in favs:
        fav_ids.append(f.movie_id)
        # On cherche le film en BDD pour avoir ses genres
        movie_in_db = db.query(Movie).filter(Movie.tmdb_id == f.movie_id).first()
        if movie_in_db and movie_in_db.genre:
            # On découpe "Action, Drame" en ["Action", "Drame"]
            genres = [g.strip() for g in movie_in_db.genre.split(",")]
            all_genres.extend(genres)

    # On compte les occurrences de chaque genre
    # Exemple : {"Action": 5, "Drame": 2}
    if all_genres:
        genre_counts = {}
        for g in all_genres:
            genre_counts[g] = genre_counts.get(g, 0) + 1
        
        # On trie pour avoir le genre le plus présent en premier
        sorted_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)
        top_genre = sorted_genres[0][0] # Le nom du genre préféré
        
        # 3. RECHERCHE BASÉE SUR LE GENRE PRÉFÉRÉ
        my_recos = db.query(Movie).filter(
            Movie.tmdb_id.notin_(fav_ids), # Pas les films déjà aimés
            Movie.genre.like(f"%{top_genre}%")
        ).order_by(Movie.rating.desc()).limit(5).all()
        
        info_label = f"Basé sur votre genre préféré : {top_genre}"
    else:
        # Fallback si aucun genre n'est trouvé
        my_recos = db.query(Movie).filter(Movie.tmdb_id.notin_(fav_ids)).order_by(Movie.rating.desc()).limit(5).all()
        info_label = "Suggestions pour vous"

    return {
        "status": "success",
        "recommendations": [format_movie(m, info_label) for m in my_recos]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)