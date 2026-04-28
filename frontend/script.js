const API_URL = "http://localhost:8000";

let offset = 0;
const LIMIT = 10;

console.log("JS LOADED");

async function loadMovies() {
  try {
    const res = await fetch(`${API_URL}/movies?limit=${LIMIT}&offset=${offset}`);

    if (!res.ok) throw new Error("Erreur API movies");

    const movies = await res.json();

    if (!Array.isArray(movies)) {
      throw new Error("Format invalide");
    }

    displayMovies(movies);
    offset += LIMIT;

  } catch (error) {
    console.error("Erreur loadMovies:", error);
  }
}

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

function showMovie(movie) {

  const movieView = document.getElementById("movieView");

  // 🔥 reset container propre
  let favContainer = document.getElementById("favContainer");
  if (!favContainer) {
    favContainer = document.createElement("div");
    favContainer.id = "favContainer";
    movieView.appendChild(favContainer);
  } else {
    favContainer.innerHTML = "";
  }

  const user = localStorage.getItem('userConnected');

  if (user) {
    const btn = document.createElement("button");
    btn.className = "btn-fav";
    btn.innerText = "⭐ Ajouter aux favoris";

    btn.onclick = () => {
      addFav(movie.tmdb_id, movie.title, movie.image_url);
    };

    favContainer.appendChild(btn);

  } else {
    favContainer.innerHTML = `<p style="color: gray;">Connectez-vous</p>`;
  }

  // UI switch
  document.getElementById("movies").classList.add("hidden");
  document.getElementById("loadMore").classList.add("hidden");
  movieView.classList.remove("hidden");

  document.getElementById("title").innerText = movie.title;
  document.getElementById("year").innerText = movie.year;
  document.getElementById("rating").innerText = "⭐ " + movie.rating;
  document.getElementById("desc").innerText = movie.description;
  document.getElementById("movieImage").src = movie.image_url;

  // 🔥 TRAILER FIX PROPRE
  const iframe = document.getElementById("trailerIframe");
  iframe.classList.add("hidden");
  iframe.src = "";

  if (movie.trailer_url) {
    let id = null;

    if (movie.trailer_url.includes("v=")) {
      id = movie.trailer_url.split("v=")[1].split("&")[0];
    } else if (movie.trailer_url.includes("youtu.be/")) {
      id = movie.trailer_url.split("youtu.be/")[1];
    }

    if (id) {
      iframe.src = `https://www.youtube.com/embed/${id}`;
      iframe.classList.remove("hidden");
    }
  }
}

function goHome() {
  document.getElementById("movieView").classList.add("hidden");
  document.getElementById("movies").classList.remove("hidden");
  document.getElementById("loadMore").classList.remove("hidden");
}

async function addFav(id, title, img) {
  const user = localStorage.getItem('userConnected');

  if (!user) return alert("Connectez-vous");

  try {
    const res = await fetch(`${API_URL}/favorites/add`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        username: user,
        tmdb_id: id,
        title: title,
        image_url: img
      })
    });

    if (!res.ok) throw new Error("Erreur ajout favori");

    alert("Ajouté !");

  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'ajout");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("backBtn").onclick = goHome;
  document.getElementById("loadMore").onclick = loadMovies;
  loadMovies();
});