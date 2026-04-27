from database import SessionLocal
from models import Movie
from main import tmdb_get, normalize_tmdb_movie

def update_movies():
    db = SessionLocal()

    print("Mise à jour des films...")

    page = 1
    added = 0

    while page <= 5:  # ≈ 100 films
        data = tmdb_get("/movie/popular", params={
            "language": "fr-FR",
            "page": page
        })

        results = data.get("results", [])

        for m in results:
            movie = normalize_tmdb_movie(m)

            # Vérifier si déjà en DB
            exists = db.query(Movie).filter_by(tmdb_id=movie["tmdb_id"]).first()

            if exists:
                # Mise à jour (optionnelle)
                exists.title = movie["title"]
                exists.description = movie["description"]
                exists.image_url = movie["image_url"]
                exists.year = movie["year"]
                exists.rating = movie["rating"]
            else:
                # Nouveau film
                db_movie = Movie(
                    tmdb_id=movie["tmdb_id"],
                    title=movie["title"],
                    description=movie["description"],
                    image_url=movie["image_url"],
                    year=movie["year"],
                    rating=movie["rating"]
                )
                db.add(db_movie)
                added += 1

        db.commit()
        page += 1

    db.close()

    print(f"Update terminé. {added} nouveaux films ajoutés.")


if __name__ == "__main__":
    update_movies()