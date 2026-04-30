import hashlib
import json
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

# Importations locales
from database import SessionLocal, init_db
from models import Favorite, Movie, RecommendationCache



app = FastAPI(title="SinghFlix AI Recommendation - Multi-Genre Mode")
RECOMMENDATION_ALGORITHM_VERSION = "all-favorites-v2"
RECOMMENDATION_LIMIT = 14

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Autorise tous les ports (8000, 5500, etc.)
    allow_credentials=True,
    allow_methods=["*"],  # Autorise POST, GET, etc.
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()

    
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
        "tmdb_id": movie.tmdb_id,
        "title": movie.title,
        "image_url": movie.image_url,
        "poster_path": movie.image_url,
        "rating": movie.rating,
        "vote_average": movie.rating,
        "genre": movie.genre,
        "genres": movie.genre,
        "description": movie.description,
        "year": movie.year,
        "trailer_url": movie.trailer_url,
        "info": info
    }


def get_favorites_hash(favs):
    favorite_ids = sorted(str(f.movie_id) for f in favs)
    hash_input = f"{RECOMMENDATION_ALGORITHM_VERSION}:{','.join(favorite_ids)}"
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()


def split_genres(genre_text):
    if not genre_text:
        return []

    return [genre.strip() for genre in genre_text.split(",") if genre.strip()]


def calculate_recommendations(favs, db: Session):
    if not favs:
        # Fallback si pas de favoris : on renvoie les mieux notés
        top_movies = db.query(Movie).order_by(Movie.rating.desc()).limit(RECOMMENDATION_LIMIT).all()
        return [format_movie(m, "Films les mieux notés") for m in top_movies]
    fav_ids = []
    favorite_profiles = []

    for f in favs:
        fav_ids.append(f.movie_id)
        movie_in_db = db.query(Movie).filter(Movie.tmdb_id == f.movie_id).first()
        favorite_genres = set(split_genres(movie_in_db.genre if movie_in_db else ""))
        if favorite_genres:
            favorite_profiles.append({
                "title": movie_in_db.title,
                "genres": favorite_genres
            })

    if not favorite_profiles:
        recommendations = db.query(Movie).filter(Movie.tmdb_id.notin_(fav_ids)).order_by(Movie.rating.desc()).limit(RECOMMENDATION_LIMIT).all()
        return [format_movie(m, "Suggestions pour vous") for m in recommendations]

    candidates = db.query(Movie).filter(Movie.tmdb_id.notin_(fav_ids)).all()
    scored_movies = []

    for movie in candidates:
        movie_genres = set(split_genres(movie.genre))
        matched_genres = set()
        matched_favorites = 0
        similarity_score = 0

        for favorite in favorite_profiles:
            overlap = movie_genres.intersection(favorite["genres"])
            if overlap:
                matched_favorites += 1
                matched_genres.update(overlap)
                similarity_score += len(overlap)

        if not matched_genres:
            continue

        # Bonus when a movie is similar to several favorite movies, not only one.
        similarity_score += matched_favorites * 2

        scored_movies.append((
            similarity_score,
            matched_favorites,
            movie.rating or 0,
            movie,
            sorted(matched_genres)
        ))

    if not scored_movies:
        recommendations = db.query(Movie).filter(Movie.tmdb_id.notin_(fav_ids)).order_by(Movie.rating.desc()).limit(RECOMMENDATION_LIMIT).all()
        return [format_movie(m, "Suggestions pour vous") for m in recommendations]

    scored_movies.sort(key=lambda item: (item[0], item[1], item[2]), reverse=True)

    results = []
    for score, matched_favorites, rating, movie, matched_genres in scored_movies[:RECOMMENDATION_LIMIT]:
        info_label = f"Parce que vous aimez : {', '.join(matched_genres)}"
        formatted = format_movie(movie, info_label)
        formatted["similarity_score"] = score
        formatted["matched_favorites"] = matched_favorites
        results.append(formatted)

    return results


# --- ROUTE PRINCIPALE ---

@app.post("/update/{user_id}")
def update_recommendations(user_id: int, db: Session = Depends(get_db)):
    favs = db.query(Favorite).filter(Favorite.user_id == user_id).all()
    favorites_hash = get_favorites_hash(favs)

    cached = db.query(RecommendationCache).filter(RecommendationCache.user_id == user_id).first()
    if cached and cached.favorites_hash == favorites_hash:
        return {
            "status": "success",
            "cached": True,
            "recommendations": json.loads(cached.recommendations_json)
        }

    recommendations = calculate_recommendations(favs, db)

    if cached:
        cached.favorites_hash = favorites_hash
        cached.recommendations_json = json.dumps(recommendations)
    else:
        db.add(RecommendationCache(
            user_id=user_id,
            favorites_hash=favorites_hash,
            recommendations_json=json.dumps(recommendations)
        ))

    db.commit()

    return {
        "status": "success",
        "cached": False,
        "recommendations": recommendations
    }

# --- NOUVELLE ROUTE : Recommandation par Film ---

@app.get("/recommendations/movie/{movie_id}")
def get_recommendations_by_movie(movie_id: int, db: Session = Depends(get_db)):
    # 1. On récupère le film de référence
    reference_movie = db.query(Movie).filter(Movie.tmdb_id == movie_id).first()
    
    if not reference_movie:
        # Si le film n'est pas en base, on renvoie les mieux notés en secours
        backup = db.query(Movie).order_by(Movie.rating.desc()).limit(RECOMMENDATION_LIMIT).all()
        return {"recommendations": [format_movie(m, "Populaire") for m in backup]}

    # 2. On prépare les genres du film de référence
    ref_genres = set(split_genres(reference_movie.genre))

    # 3. On récupère les candidats (tous les films sauf celui-ci)
    candidates = db.query(Movie).filter(Movie.tmdb_id != movie_id).all()
    scored_movies = []

    for movie in candidates:
        movie_genres = set(split_genres(movie.genre))
        # On calcule l'intersection (les genres en commun)
        common_genres = ref_genres.intersection(movie_genres)
        
        if common_genres:
            # Score = nombre de genres en commun + bonus sur la note
            score = len(common_genres) * 5 + (movie.rating or 0)
            scored_movies.append({
                "score": score,
                "movie": movie,
                "common": list(common_genres)
            })

    # 4. Tri par score décroissant
    scored_movies.sort(key=lambda x: x["score"], reverse=True)

    # 5. Formatage des résultats
    results = []
    for item in scored_movies[:RECOMMENDATION_LIMIT]:
        info = f"Similaire à {reference_movie.title}"
        results.append(format_movie(item["movie"], info))

    return {"status": "success", "recommendations": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
