import requests
import os
from dotenv import load_dotenv

from database import SessionLocal, engine
from models import Movie,Base

load_dotenv()
Base.metadata.create_all(bind=engine)

TMDB_TOKEN = os.getenv("TMDB_TOKEN")


def tmdb_get(endpoint, params=None):
    url = f"https://api.themoviedb.org/3{endpoint}"
    headers = {"Authorization": f"Bearer {TMDB_TOKEN}"}
    return requests.get(url, headers=headers, params=params).json()


def normalize_tmdb_movie(m):
    return {
        "tmdb_id": m.get("id"),
        "title": m.get("title"),
        "description": m.get("overview"),
        "image_url": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get("poster_path") else "",
        "year": m.get("release_date", "")[:4],
        "rating": m.get("vote_average")
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
                exists.trailer_url = trailer
            else:
                db.add(Movie(
                    tmdb_id=movie["tmdb_id"],
                    title=movie["title"],
                    description=movie["description"],
                    image_url=movie["image_url"],
                    year=movie["year"],
                    rating=movie["rating"],
                    trailer_url=trailer
                ))

        db.commit()
        page += 1

    db.close()
    print("update done")


if __name__ == "__main__":
    update_movies()