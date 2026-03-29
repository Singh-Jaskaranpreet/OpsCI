const API_URL = "http://127.0.0.1:8000";

let allMovies = [];
let currentLimit = 10;

// LOAD MOVIES
async function loadMovies(limit = 10) {
  const res = await fetch(`${API_URL}/movies?limit=${limit}`);
  allMovies = await res.json();
  displayMovies(allMovies);
}

// DISPLAY GRID
function displayMovies(movies) {
  const container = document.getElementById("movies");
  container.innerHTML = "";

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${movie.image_url}">
      <h3>${movie.title}</h3>
      <p>${movie.year}</p>
    `;

    card.onclick = () => showMovie(movie);

    container.appendChild(card);
  });
}

// SHOW MOVIE
async function showMovie(movie) {
  document.getElementById("movies").classList.add("hidden");
  document.getElementById("loadMore").classList.add("hidden");
  document.getElementById("movieView").classList.remove("hidden");

  document.getElementById("title").innerText = movie.title;
  document.getElementById("year").innerText = movie.year;
  document.getElementById("rating").innerText = "⭐ " + movie.rating;
  document.getElementById("desc").innerText = movie.description;
  document.getElementById("movieImage").src = movie.image_url;

  const fallback = document.getElementById("trailerFallback");
  const thumb = document.getElementById("trailerThumbnail");

  fallback.classList.add("hidden");

  try {
    const res = await fetch(`${API_URL}/movies/${movie.tmdb_id}/trailer`);
    const data = await res.json();

    if (data.url) {
      const videoId = data.url.split("v=")[1];

      thumb.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      fallback.classList.remove("hidden");

      fallback.onclick = () => {
        window.open(data.url, "_blank");
      };

    } else {
      fallback.innerHTML = "<p>Trailer non disponible</p>";
      fallback.classList.remove("hidden");
    }

  } catch {
    fallback.innerHTML = "<p>Erreur chargement trailer</p>";
    fallback.classList.remove("hidden");
  }
}

// BACK
function goHome() {
  document.getElementById("movieView").classList.add("hidden");
  document.getElementById("movies").classList.remove("hidden");
  document.getElementById("loadMore").classList.remove("hidden");

  document.getElementById("trailerThumbnail").src = "";
}

// EVENTS
document.getElementById("backBtn").onclick = goHome;

document.getElementById("loadMore").onclick = () => {
  currentLimit += 10;
  loadMovies(currentLimit);
};

document.getElementById("search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();

  const filtered = allMovies.filter(m =>
    m.title.toLowerCase().includes(q)
  );

  displayMovies(filtered);
});

// INIT
loadMovies();