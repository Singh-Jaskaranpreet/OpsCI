const container = document.getElementById("movies");

/**
 * G&eacute;n&egrave;re les cartes de films dans la page.
 */
movies.forEach(movie => {
  const card = document.createElement("article");
  const API_BASE = 'https://localhost:3000/'
  const imageSrc = API_BASE + movie.image_url
  card.className = "card";
  card.innerHTML = `
    <img src="${imageSrc}" alt="${movie.title}">
    <div class="card-content">
      <h2>${movie.title}</h2>
      <p class="meta"><strong>R&eacute;alisateur :</strong> ${movie.director}</p>
      <p class="desc">${movie.description}</p>
    </div>
  `;
  container.appendChild(card);
});

async function loadMovies(limit = 5) {
  const res = await fetch(`http://127.0.0.1:8000/movies?limit=${limit}`);
  const movies = await res.json();
  return movies;
}