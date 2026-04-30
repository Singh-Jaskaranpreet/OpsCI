"""End-to-end tests for the backend API using FastAPI's TestClient + SQLite."""


# ---------- Basic ----------

def test_hello(client):
    r = client.get("/hello")
    assert r.status_code == 200
    assert r.json() == {"message": "Hello World"}


# ---------- Movies ----------

def test_list_movies(client):
    r = client.get("/movies")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 3
    titles = {m["title"] for m in data}
    assert {"Inception", "The Matrix", "Amelie"} <= titles


def test_search_movies_by_title(client):
    r = client.get("/movies", params={"q": "matrix"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "The Matrix"


def test_filter_movies_by_genre(client):
    r = client.get("/movies", params={"genre": "Romance"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "Amelie"


def test_get_movie_by_tmdb_id(client):
    r = client.get("/movies/101")
    assert r.status_code == 200
    assert r.json()["title"] == "Inception"


def test_get_movie_not_found(client):
    r = client.get("/movies/9999")
    assert r.status_code == 404


def test_trending_sorted_by_rating(client):
    r = client.get("/movies/trending")
    assert r.status_code == 200
    ratings = [m["rating"] for m in r.json()]
    assert ratings == sorted(ratings, reverse=True)


def test_movie_filters_returns_unique_genres(client):
    r = client.get("/movies/filters")
    assert r.status_code == 200
    genres = r.json()["genres"]
    # Genres should be split on comma, trimmed, deduped, sorted
    assert genres == sorted(set(genres))
    assert {"Action", "Sci-Fi", "Romance", "Comedy"} <= set(genres)


def test_get_trailer(client):
    r = client.get("/movies/101/trailer")
    assert r.status_code == 200
    assert r.json() == {"url": "https://youtu.be/INC"}


# ---------- Auth ----------

def test_register_then_login(client):
    r = client.post("/register", data={"username": "alice", "password": "pw"})
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

    r = client.post("/login", data={"username": "alice", "password": "pw"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["username"] == "alice"
    assert isinstance(body["user_id"], int)


def test_register_duplicate(client):
    client.post("/register", data={"username": "bob", "password": "pw"})
    r = client.post("/register", data={"username": "bob", "password": "pw"})
    assert r.status_code == 400


def test_login_bad_credentials(client):
    r = client.post("/login", data={"username": "ghost", "password": "x"})
    assert r.status_code == 401


# ---------- Favorites ----------

def _register(client, name="alice"):
    client.post("/register", data={"username": name, "password": "pw"})


def test_favorites_full_flow(client):
    _register(client)

    # Nothing yet
    r = client.get("/favorites/check", params={"username": "alice", "movie_id": 101})
    assert r.json() == {"is_favorite": False}

    # Add
    r = client.post(
        "/favorites/add",
        data={"username": "alice", "movie_id": 101,
              "title": "Inception", "image_url": "/p/inception.jpg"},
    )
    assert r.status_code == 200
    assert "recommendations" in r.json()

    # Check -> True
    r = client.get("/favorites/check", params={"username": "alice", "movie_id": 101})
    assert r.json() == {"is_favorite": True}

    # List
    r = client.get("/favorites/alice")
    assert r.status_code == 200
    favs = r.json()
    assert len(favs) == 1
    assert favs[0]["title"] == "Inception"

    # Remove
    r = client.post(
        "/favorites/remove", data={"username": "alice", "movie_id": 101}
    )
    assert r.status_code == 200

    # Check -> False
    r = client.get("/favorites/check", params={"username": "alice", "movie_id": 101})
    assert r.json() == {"is_favorite": False}


def test_add_favorite_unknown_user(client):
    r = client.post(
        "/favorites/add",
        data={"username": "ghost", "movie_id": 101,
              "title": "x", "image_url": "y"},
    )
    assert r.status_code == 401


def test_favorites_for_unknown_user_returns_empty(client):
    r = client.get("/favorites/ghost")
    assert r.status_code == 200
    assert r.json() == []
