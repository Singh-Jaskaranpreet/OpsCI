const API_URL = "http://localhost:8000";

let offset = 0;
const LIMIT = 10;

console.log("JS LOADED");

// ---------------------
// LOAD MOVIES
// ---------------------
async function loadMovies() {
  try {
    const res = await fetch(`${API_URL}/movies?limit=${LIMIT}&offset=${offset}`);
    const movies = await res.json();

    console.log("movies:", movies);

    if (!movies.length) {
      console.log("Plus de films");
      return;
    }

    displayMovies(movies);
    offset += LIMIT;

  } catch (error) {
    console.error("Erreur loadMovies:", error);
  }
}

// ---------------------
// DISPLAY MOVIES
// ---------------------
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

// ---------------------
// SHOW MOVIE
// ---------------------
function showMovie(movie) {

  let favContainer = document.getElementById("favContainer");

  if (!favContainer) {
    favContainer = document.createElement("div");
    favContainer.id = "favContainer";
    document.getElementById("movieView").appendChild(favContainer);
  }

  const user = localStorage.getItem('userConnected');

  if (user) {
    favContainer.innerHTML = `
      <button id="favBtn" class="btn-fav">⭐ Ajouter aux favoris</button>
    `;

    document.getElementById("favBtn").onclick = () => {
      addFav(movie.tmdb_id, movie.title, movie.image_url);
    };

  } else {
    favContainer.innerHTML = `
      <p style="color: gray;">Connectez-vous pour ajouter en favori</p>
    `;
  }

  document.getElementById("movies").classList.add("hidden");
  document.getElementById("loadMore").classList.add("hidden");
  document.getElementById("movieView").classList.remove("hidden");

  document.getElementById("title").innerText = movie.title || "No title";
  document.getElementById("year").innerText = movie.year || "";
  document.getElementById("rating").innerText = "⭐ " + (movie.rating || "N/A");
  document.getElementById("desc").innerText = movie.description || "";
  document.getElementById("movieImage").src = movie.image_url || "";
}

// ---------------------
// BACK HOME
// ---------------------
function goHome() {
  document.getElementById("movieView").classList.add("hidden");
  document.getElementById("movies").classList.remove("hidden");
  document.getElementById("loadMore").classList.remove("hidden");
}

// ---------------------
// ADD FAVORITE (FIXED)
// ---------------------
async function addFav(id, title, img) {
  const user = localStorage.getItem('userConnected');

  if (!user) {
    alert("Connectez-vous !");
    return;
  }

  try {
    await fetch(`${API_URL}/favorites/add`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        username: user,
        tmdb_id: id,
        title: title,
        image_url: img
      })
    });

    alert("Ajouté !");
  } catch (err) {
    console.error("Erreur addFav:", err);
  }
}

// ---------------------
// INIT UI
// ---------------------
document.addEventListener('DOMContentLoaded', () => {

  const user = localStorage.getItem('userConnected');
  const loginBtn = document.getElementById('loginBtn');
  const dashBtn = document.getElementById('dashboardBtn');

  if (user) {
    if (loginBtn) loginBtn.classList.add('hidden');

    if (dashBtn) {
      dashBtn.classList.remove('hidden');
      dashBtn.onclick = () => window.location.href = "/dashboard";
    }

  } else {
    if (loginBtn) {
      loginBtn.classList.remove('hidden');
      loginBtn.onclick = () => window.location.href = "/login";
    }
  }

  document.getElementById("backBtn").onclick = goHome;
  document.getElementById("loadMore").onclick = loadMovies;

  // search simple
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