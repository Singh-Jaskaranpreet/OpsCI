import requests
import os
from dotenv import load_dotenv

from database import SessionLocal
from models import Movie

load_dotenv()

TMDB_TOKEN = os.getenv("TMDB_TOKEN")

def tmdb_get(endpoint, params=None):
    url = f"https://api.themoviedb.org/3{endpoint}"

    headers = {
        "Authorization": f"Bearer {TMDB_TOKEN}"
    }

    response = requests.get(url, headers=headers, params=params)
    return response.json()


def normalize_tmdb_movie(m):
    return {
        "tmdb_id": m.get("id"),
        "title": m.get("title"),
        "description": m.get("overview"),
        "image_url": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get("poster_path") else "",
        "year": m.get("release_date", "")[:4],
        "rating": m.get("vote_average")
    }


def update_movies():
    db = SessionLocal()

    print("update movies...")

    page = 1
    added = 0

    while page <= 5:
        data = tmdb_get("/movie/popular", params={
            "language": "fr-FR",
            "page": page
        })

        results = data.get("results", [])

        for m in results:
            movie = normalize_tmdb_movie(m)

            exists = db.query(Movie).filter_by(tmdb_id=movie["tmdb_id"]).first()

            if exists:
                exists.title = movie["title"]
                exists.description = movie["description"]
                exists.image_url = movie["image_url"]
                exists.year = movie["year"]
                exists.rating = movie["rating"]
            else:
                db.add(Movie(
                    tmdb_id=movie["tmdb_id"],
                    title=movie["title"],
                    description=movie["description"],
                    image_url=movie["image_url"],
                    year=movie["year"],
                    rating=movie["rating"]
                ))
                added += 1

        db.commit()
        page += 1

    db.close()

    print(f"done. {added} new movies")


if __name__ == "__main__":
    update_movies()