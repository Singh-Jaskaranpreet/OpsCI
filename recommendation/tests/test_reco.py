"""Unit tests for the recommendation engine."""
from types import SimpleNamespace

import recom
from models import Favorite


# ---------- split_genres ----------

def test_split_genres_basic():
    assert recom.split_genres("Action, Sci-Fi") == ["Action", "Sci-Fi"]


def test_split_genres_strips_whitespace_and_empties():
    assert recom.split_genres("  Action ,, Drama , ") == ["Action", "Drama"]


def test_split_genres_empty():
    assert recom.split_genres("") == []
    assert recom.split_genres(None) == []


# ---------- get_favorites_hash ----------

def test_hash_is_deterministic_regardless_of_order():
    favs_a = [SimpleNamespace(movie_id=3), SimpleNamespace(movie_id=1),
              SimpleNamespace(movie_id=2)]
    favs_b = [SimpleNamespace(movie_id=2), SimpleNamespace(movie_id=3),
              SimpleNamespace(movie_id=1)]
    assert recom.get_favorites_hash(favs_a) == recom.get_favorites_hash(favs_b)


def test_hash_changes_when_favorites_change():
    h1 = recom.get_favorites_hash([SimpleNamespace(movie_id=1)])
    h2 = recom.get_favorites_hash([SimpleNamespace(movie_id=1),
                                   SimpleNamespace(movie_id=2)])
    assert h1 != h2


def test_hash_includes_algorithm_version():
    # Same favs but different algo versions -> different hash
    h1 = recom.get_favorites_hash([SimpleNamespace(movie_id=1)])
    original = recom.RECOMMENDATION_ALGORITHM_VERSION
    try:
        recom.RECOMMENDATION_ALGORITHM_VERSION = "other-version"
        h2 = recom.get_favorites_hash([SimpleNamespace(movie_id=1)])
    finally:
        recom.RECOMMENDATION_ALGORITHM_VERSION = original
    assert h1 != h2


# ---------- calculate_recommendations ----------

def test_recommend_falls_back_to_top_rated_when_no_favs(seeded_db):
    results = recom.calculate_recommendations([], seeded_db)
    # Top-rated first (Alien 8.5), never exceeds the limit
    assert len(results) <= recom.RECOMMENDATION_LIMIT
    assert results[0]["title"] == "Alien"
    assert results[0]["info"] == "Films les mieux notés"


def test_recommend_excludes_favorites_and_matches_genres(seeded_db):
    # User loves "Alien" (Horror, Sci-Fi). Expected: prefers sci-fi/horror movies,
    # never returns Alien itself.
    fav = Favorite(movie_id=1, title="Alien", image_url="", user_id=1)
    seeded_db.add(fav)
    seeded_db.commit()

    results = recom.calculate_recommendations([fav], seeded_db)

    returned_ids = {r["tmdb_id"] for r in results}
    assert 1 not in returned_ids  # Alien (the favorite) excluded
    # All returned movies share at least one genre with Alien
    assert all(
        ({"Horror", "Sci-Fi"} & set(recom.split_genres(r["genre"])))
        for r in results
    )
    # At the very least "The Thing" (Horror, Sci-Fi) must be there - 2 common genres
    assert 6 in returned_ids


def test_recommend_scoring_order(seeded_db):
    # Favorite: Alien (Horror, Sci-Fi)
    # - The Thing (Horror, Sci-Fi)    -> 2 common genres -> top
    # - Predator / Terminator (Sci-Fi) -> 1 common genre  -> behind
    # - Amelie / Notting Hill          -> 0 common       -> excluded
    fav = Favorite(movie_id=1, title="Alien", image_url="", user_id=1)
    seeded_db.add(fav)
    seeded_db.commit()

    results = recom.calculate_recommendations([fav], seeded_db)
    returned_ids = [r["tmdb_id"] for r in results]

    assert returned_ids[0] == 6   # The Thing is the best match
    # Romance/Comedy movies must NOT appear (no genre overlap with Alien)
    assert 3 not in returned_ids
    assert 5 not in returned_ids


def test_recommend_each_result_has_info_label(seeded_db):
    fav = Favorite(movie_id=1, title="Alien", image_url="", user_id=1)
    seeded_db.add(fav)
    seeded_db.commit()

    results = recom.calculate_recommendations([fav], seeded_db)
    assert all(r["info"].startswith("Parce que vous aimez") for r in results)
