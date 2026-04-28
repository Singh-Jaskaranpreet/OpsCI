const API_URL = "http://127.0.0.1:8000";

let offset = 0;
const LIMIT = 10;

// LOAD MOVIES
async function loadMovies() {
  try {
    const res = await fetch(`${API_URL}/movies?limit=${LIMIT}&offset=${offset}`);
    const movies = await res.json();

    if (!movies.length) {
      console.log("Plus de films");
      return;
    }

    displayMovies(movies);
    offset += LIMIT;

  } catch (error) {
    console.error("Erreur:", error);
  }
}

// DISPLAY
function displayMovies(movies) {
  const container = document.getElementById("movies");

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${movie.image_url || ''}">
      <h3>${movie.title || 'No title'}</h3>
      <p>${movie.year || ''}</p>
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

  document.getElementById("title").innerText = movie.title || "No title";
  document.getElementById("year").innerText = movie.year || "";
  document.getElementById("rating").innerText = "⭐ " + (movie.rating || "N/A");
  document.getElementById("desc").innerText = movie.description || "";
  document.getElementById("movieImage").src = movie.image_url || "";

  const iframe = document.getElementById("trailerIframe");
  iframe.classList.add("hidden");
  iframe.src = "";

  try {
    const res = await fetch(`${API_URL}/movies/${movie.tmdb_id}/trailer`);
    const data = await res.json();

    if (data.url && data.url.includes("v=")) {
      const videoId = data.url.split("v=")[1];
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Erreur trailer:", error);
  }
}

// BACK
function goHome() {
  document.getElementById("movieView").classList.add("hidden");
  document.getElementById("movies").classList.remove("hidden");
  document.getElementById("loadMore").classList.remove("hidden");

  const iframe = document.getElementById("trailerIframe");
  iframe.src = "";
  iframe.classList.add("hidden");
}

// EVENTS
document.addEventListener('DOMContentLoaded', () => {

  document.getElementById("backBtn").onclick = goHome;
  document.getElementById("loadMore").onclick = loadMovies;

  document.getElementById("search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();

    const cards = document.querySelectorAll(".card");

    cards.forEach(card => {
      const title = card.querySelector("h3").innerText.toLowerCase();
      card.style.display = title.includes(q) ? "block" : "none";
    });
  });

  loadMovies();
});