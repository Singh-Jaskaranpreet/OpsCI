import requests
import os
from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal, init_db
from models import Movie

init_db()

TMDB_TOKEN = os.getenv("TMDB_TOKEN")
GENRES_MAP = {
    28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 
    80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Familial", 
    14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique", 
    9648: "Mystère", 10749: "Romance", 878: "Science-Fiction", 
    53: "Thriller", 10752: "Guerre", 37: "Western"
}

def tmdb_get(endpoint, params=None):
    if not TMDB_TOKEN:
        raise RuntimeError("TMDB_TOKEN manquant dans le fichier .env")

    url = f"https://api.themoviedb.org/3{endpoint}"
    headers = {"Authorization": f"Bearer {TMDB_TOKEN}"}
    response = requests.get(url, headers=headers, params=params, timeout=10)
    response.raise_for_status()
    return response.json()


def normalize_tmdb_movie(m):
    # On récupère tous les noms de genres correspondants aux IDs
    genre_ids = m.get("genre_ids", [])
    genres_list = [GENRES_MAP.get(gid) for gid in genre_ids if GENRES_MAP.get(gid)]
    
    # On les joint en une chaîne : "Action, Aventure, Science-Fiction"
    genres_string = ", ".join(genres_list)

    return {
        "tmdb_id": m.get("id"),
        "title": m.get("title"),
        "description": m.get("overview"),
        "image_url": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get("poster_path") else "",
        "year": m.get("release_date", "")[:4],
        "rating": m.get("vote_average"),
        "genre": genres_string
    }


# 🔥 NEW
def get_trailer(tmdb_id):
    data = tmdb_get(f"/movie/{tmdb_id}/videos")

    for v in data.get("results", []):
        if v["type"] == "Trailer" and v["site"] == "YouTube":
            return f"https://www.youtube.com/watch?v={v['key']}"

    return None


def update_movies():
    db = SessionLocal()

    page = 1

    while page <= 5:
        data = tmdb_get("/movie/popular", {
            "language": "fr-FR",
            "page": page
        })

        for m in data.get("results", []):

            movie = normalize_tmdb_movie(m)
            trailer = get_trailer(movie["tmdb_id"])  # 🔥

            exists = db.query(Movie).filter_by(tmdb_id=movie["tmdb_id"]).first()

            if exists:
                exists.title = movie["title"]
                exists.description = movie["description"]
                exists.image_url = movie["image_url"]
                exists.year = movie["year"]
                exists.rating = movie["rating"]
                exists.genre = movie["genre"]
                exists.trailer_url = trailer
            else:
                db.add(Movie(
                    tmdb_id=movie["tmdb_id"],
                    title=movie["title"],
                    description=movie["description"],
                    image_url=movie["image_url"],
                    year=movie["year"],
                    rating=movie["rating"],
                    genre = movie["genre"],
                    trailer_url=trailer
                ))

        db.commit()
        page += 1

    db.close()
    print("update done")


if __name__ == "__main__":
    update_movies()
