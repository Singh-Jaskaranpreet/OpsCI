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

  const iframe = document.getElementById("trailerIframe");
  iframe.classList.add("hidden"); // Masquer l'iframe au début

  try {
      const res = await fetch(`${API_URL}/movies/${movie.tmdb_id}/trailer`);
      const data = await res.json();

      if (data.url) {
          const videoId = data.url.split("v=")[1];  // Extraire l'ID de la vidéo YouTube
          iframe.src = `https://www.youtube.com/embed/${videoId}`;  // Insérer l'ID dans l'iframe
          iframe.classList.remove("hidden");  // Afficher l'iframe avec la vidéo
      } else {
          iframe.classList.add("hidden");
          alert("Trailer non disponible pour ce film.");
      }
  } catch (error) {
      console.error("Erreur lors du chargement du trailer", error);
      alert("Erreur de chargement du trailer.");
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