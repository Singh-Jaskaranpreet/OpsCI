const API_URL = "http://127.0.0.1:8000";

let allMovies = [];

async function loadMovies() {
  const res = await fetch(`${API_URL}/movies?limit=40`);
  allMovies = await res.json();

  showCategory("trending"); // affichage par défaut
}

function showCategory(category) {
  let movies = [];

  if (category === "trending") {
    movies = allMovies.slice(0, 10);
  } else if (category === "popular") {
    movies = allMovies.slice(10, 20);
  } else if (category === "foryou") {
    movies = allMovies.slice(20, 30);
  } else if (category === "new") {
    movies = allMovies.slice(30, 40);
  }

  displayMovies(movies);
}

function displayMovies(movies) {
  const container = document.getElementById("movies");
  container.innerHTML = "";

  movies.forEach(movie => {
    const imageSrc = movie.image_url
      ? API_URL + movie.image_url
      : "https://via.placeholder.com/300x450";

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${imageSrc}" alt="${movie.title}">
      <h2>${movie.title}</h2>
      <p class="meta">${movie.director}</p>
    `;

    container.appendChild(card);
  });
}

loadMovies();