const API_URL = "http://127.0.0.1:8000";

let offset = 0;
const LIMIT = 14;
let currentView = "catalog";

function getMovieQueryParams() {
  const search = document.getElementById("search");
  const genreFilter = document.getElementById("genreFilter");
  const params = new URLSearchParams({
    limit: LIMIT,
    offset
  });

  if (search && search.value.trim()) params.append("q", search.value.trim());
  if (genreFilter && genreFilter.value) params.append("genre", genreFilter.value);

  return params.toString();
}

// LOAD MOVIES
async function loadMovies() {
  try {
    const res = await fetch(`${API_URL}/movies?${getMovieQueryParams()}`);
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

function renderMovieCard(movie, options = {}) {
  const info = options.info || movie.info || "";
  return `
    <img src="${movie.image_url || movie.poster_path || ''}">
    <div class="card-body">
      <h3>${movie.title || 'No title'}</h3>
      <div class="card-meta">
        <p>Année de sortie : ${movie.year || 'N/A'}</p>
        <p>TMDB : ${movie.rating || movie.vote_average || 'N/A'}</p>
        ${info ? `<p class="reco-info">${info}</p>` : ''}
      </div>
    </div>
  `;
}

// DISPLAY
function displayMovies(movies) {
  const container = document.getElementById("movies");
  if (!container) return;

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = renderMovieCard(movie);

    card.onclick = () => showMovie(movie);
    container.appendChild(card);
  });
}

// SHOW MOVIE
async function showMovie(movie) {
  const movieView = document.getElementById("movieView");
  const recoContainer = document.getElementById("reco-container");
  const searchFilters = document.getElementById("searchFilters");

  document.querySelectorAll(".app-view").forEach(view => view.classList.add("hidden"));
  if (searchFilters) searchFilters.classList.add("hidden");
  if (movieView) movieView.classList.remove("hidden");
  if (recoContainer) recoContainer.innerHTML = "";

  document.getElementById("title").innerText = movie.title || "No title";
  const genreElem = document.getElementById("genre");
  if (genreElem) {
      genreElem.innerText = "Genre : " + (movie.genre || "Non spécifié");
  }
  
  document.getElementById("year").innerText = "Année de sortie : " + (movie.year || "N/A");
  document.getElementById("rating").innerText = "TMDB rating : " + (movie.rating || "N/A");
  document.getElementById("desc").innerText = movie.description || "";
  document.getElementById("movieImage").src = movie.image_url || "";
  
  const favContainer = document.getElementById("favContainer");
  const username = localStorage.getItem('userConnected');

  if (favContainer) {
    favContainer.innerHTML = "";
  }

  if (username && favContainer) {
    // On demande au Backend si c'est déjà en favori
    const checkRes = await fetch(`${API_URL}/favorites/check?username=${username}&movie_id=${movie.tmdb_id}`);
    const checkData = await checkRes.json();

    const btn = document.createElement("button");

    if (checkData.is_favorite) {
      btn.innerText = "❤️ Dans tes favoris";
      btn.style.backgroundColor = "#e50914"; // Rouge Netflix
    } else {
      btn.innerText = "⭐ Ajouter aux favoris";
      btn.onclick = () => ajouterAuxFavoris(movie.tmdb_id, movie.title, movie.image_url);
    }
    favContainer.appendChild(btn);
  } else if (favContainer) {
    const btn = document.createElement("button");
    btn.innerText = "Se connecter pour ajouter aux favoris";
    btn.onclick = () => window.location.href = "login.html";
    favContainer.appendChild(btn);
  }

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

  try {
      // ON APPELLE LE PORT 8000 (API_URL) au lieu de 8001
      const res = await fetch(`${API_URL}/movies/${movie.tmdb_id}/recommendations`);
      const data = await res.json();

      if (data.recommendations) {
          afficherLesSuggestions(data.recommendations);
      }
  } catch (e) {
      console.error("Erreur via le proxy backend:", e);
  }

}

// BACK
function goHome() {
  // 1. On cache la vue détail du film
  document.getElementById("movieView").classList.add("hidden");

  // 2. On arrête et cache le trailer YouTube
  const iframe = document.getElementById("trailerIframe");
  if (iframe) {
    iframe.src = "";
    iframe.classList.add("hidden");
  }

  // 3. REVENIR À LA VUE CATALOGUE (Onglets)
  // On cache toutes les vues
  document.querySelectorAll('.app-view').forEach(view => view.classList.add('hidden'));
  
  // On réaffiche uniquement le catalogue (la grille de films principale)
  const catalog = document.getElementById("catalogView");
  if (catalog) {
      catalog.classList.remove("hidden");
  }

  // 4. On réactive le bouton "Films" dans la barre d'onglets
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const catalogBtn = document.querySelector('[data-view="catalog"]');
  if (catalogBtn) {
      catalogBtn.classList.add('active');
  }

  // 5. On réaffiche les filtres et le bouton "Charger plus"
  document.getElementById("searchFilters").classList.remove("hidden");
  document.getElementById("loadMore").classList.remove("hidden");
}

async function retirerDesFavoris(id) {
  const user = localStorage.getItem('userConnected');
  if (!user) return alert("Connecte-toi d'abord !");

  const form = new FormData();
  form.append('username', user);
  form.append('movie_id', id);

  try {
    const res = await fetch(`${API_URL}/favorites/remove`, {
      method: 'POST',
      body: form
    });

    const data = await res.json();

    if (res.ok) {
      const favContainer = document.getElementById("favContainer");
      const btn = favContainer ? favContainer.querySelector("button") : null;
      if (btn) {
        btn.innerText = "⭐ Ajouter aux favoris";
        btn.style.backgroundColor = "orange";
        const currentTitle = document.getElementById("title").innerText;
        const currentImage = document.getElementById("movieImage").src;
        btn.onclick = () => ajouterAuxFavoris(id, currentTitle, currentImage);
      }

      await refreshHomeUserSections();
    } else {
      alert(data.message || "Erreur lors de la suppression");
    }
  } catch (err) {
    console.error("Erreur:", err);
  }
}

async function ajouterAuxFavoris(id, title, imageUrl) {
  const user = localStorage.getItem('userConnected');
  if (!user) return alert("Connecte-toi d'abord !");

  const form = new FormData();
  form.append('username', user);
  form.append('movie_id', id);
  form.append('title', title);
  form.append('image_url', imageUrl);

  try {
    const res = await fetch(`${API_URL}/favorites/add`, {
      method: 'POST',
      body: form
    });
    
    const data = await res.json();

    if (res.ok) {
      // 1. Mise à jour du bouton (ton code actuel)
      const favContainer = document.getElementById("favContainer");
      const btn = favContainer.querySelector("button");
      if (btn) {
        btn.innerText = "❤️ Dans tes favoris";
        btn.style.backgroundColor = "#e50914";
      }
      /*
      // 2. AFFICHAGE DES RECOMMANDATIONS
      if (data.recommendations && data.recommendations.length > 0) {
        afficherLesSuggestions(data.recommendations);
      } else {
        alert("Ajouté avec succès !");
      }*/
      await refreshHomeUserSections();
    } else {
      alert(data.message || "Erreur lors de l'ajout");
    }
  } catch (err) {
    console.error("Erreur:", err);
  }
}

function updateNavbar() {
    const user = localStorage.getItem('userConnected');
    const loginBtn = document.getElementById('loginBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');

    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (dashboardBtn) {
            dashboardBtn.classList.remove('hidden');
            dashboardBtn.innerText = `Se déconnecter (${user})`;
            dashboardBtn.onclick = () => {
              localStorage.removeItem('userConnected');
              window.location.href = "index.html";
            };
        }
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (dashboardBtn) dashboardBtn.classList.add('hidden');
    }
}
// INSCRIPTION
async function sinscrire() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    // On crée un objet FormData (requis par ton Python Form(...))
    const formData = new FormData();
    formData.append('username', u);
    formData.append('password', p);

    try {
        const res = await fetch('http://127.0.0.1:8000/register', {
            method: 'POST',
            body: formData // PAS de JSON.stringify, PAS de Header Content-Type
        });

        const data = await res.json();

        if (res.ok) {
            alert("Compte créé !");
            window.location.href = "login.html";
        } else {
            alert("Erreur : " + (data.detail || "Inscription impossible"));
        }
    } catch (err) {
        alert("Serveur injoignable");
    }
}

// CONNEXION
async function connecter(event) {
    if (event) event.preventDefault();
    const u = document.getElementById("username").value;
    const p = document.getElementById("password").value;

    const formData = new FormData();
    formData.append('username', u);
    formData.append('password', p);

    try {
        const res = await fetch('http://127.0.0.1:8000/login', {
            method: "POST",
            body: formData
        });
        const data = await res.json();

        // Attention : ton Python renvoie {"status": "ok"}, pas {"success": true}
        if (res.ok && (data.status === "ok" || data.username)) {
            localStorage.setItem("userConnected", u);
            window.location.href = "index.html";
        } else {
            alert("Identifiants incorrects");
        }
    } catch (err) {
        alert("Erreur serveur");
    }
}

async function chargerDashboard() {
  const user = localStorage.getItem('userConnected');
  if (!user) return window.location.href = "login.html";

  // 1. Charger les Favoris
  const resFav = await fetch(`${API_URL}/favorites/${user}`);
  const favs = await resFav.json();
  
  const favsContainer = document.getElementById('favs');
  if (favsContainer) {
    if (favs.length === 0) {
      favsContainer.innerHTML = `<p class="empty-message">Aucun favori pour le moment.</p>`;
    } else {
      favsContainer.innerHTML = favs.map(f => `
        <div class="card favorite-card">
          <div onclick="chargerEtAfficher(${f.movie_id})">
            <img src="${f.image_url}">
            <h3>${f.title}</h3>
          </div>
          <button class="remove-fav-btn" onclick="retirerDesFavoris(${f.movie_id})">Retirer</button>
        </div>
      `).join('');
    }
  }

  // 2. Charger les Recommendations depuis le backend principal
  try {
    const resReco = await fetch(`${API_URL}/recommendations/${user}`);
    const dataReco = await resReco.json();
    if (dataReco.recommendations && dataReco.recommendations.length > 0) {
        afficherLesSuggestions(dataReco.recommendations);
    } else {
        afficherLesSuggestions([]);
    }
  } catch (e) {
    console.log("Recommendations indisponibles.");
  }
}



async function chargerEtAfficher(movieId) {
    const res = await fetch(`${API_URL}/movies/${movieId}`);
    const movieData = await res.json();
    showMovie(movieData); // Ta fonction existante
}

async function refreshHomeUserSections() {
  const movieView = document.getElementById("movieView");
  const user = localStorage.getItem("userConnected");

  if (!user || (movieView && !movieView.classList.contains("hidden"))) {
    return;
  }

  if (currentView === "favorites") await chargerFavoris("homeFavs");
  if (currentView === "recommendations") await chargerRecommendations("homeRecoContainer");
}

async function chargerFavoris(containerId) {
  const user = localStorage.getItem("userConnected");
  const favsContainer = document.getElementById(containerId);
  if (!user || !favsContainer) return;

  const resFav = await fetch(`${API_URL}/favorites/${user}`);
  const favs = await resFav.json();

  if (favs.length === 0) {
    favsContainer.innerHTML = `<p class="empty-message">Aucun favori pour le moment.</p>`;
    return;
  }

  favsContainer.innerHTML = favs.map(f => `
    <div class="card favorite-card">
      <div onclick="chargerEtAfficher(${f.movie_id})">
        ${renderMovieCard({
          title: f.title,
          image_url: f.image_url,
          year: f.year,
          rating: f.rating
        })}
      </div>
      <button class="remove-fav-btn" onclick="retirerDesFavoris(${f.movie_id})">Retirer</button>
    </div>
  `).join('');
}

async function chargerRecommendations(containerId) {
  const user = localStorage.getItem("userConnected");
  if (!user) return;

  try {
    const resReco = await fetch(`${API_URL}/recommendations/${user}`);
    const dataReco = await resReco.json();
    afficherLesSuggestions(dataReco.recommendations || [], containerId);
  } catch (e) {
    console.log("Recommendations indisponibles.");
    afficherLesSuggestions([], containerId);
  }
}

function afficherLesSuggestions(movies, containerId = "reco-container") {
    // 1. On cible l'ID PRÉCIS du container de recommandations
    let recoDiv = document.getElementById(containerId);
    
    // Si on ne le trouve pas (par exemple sur l'accueil), on ne fait rien 
    // ou on cherche un autre endroit spécifique.
    if (!recoDiv) return;
    let titreDynamique = "Suggestions pour vous"; 
  

    if (!movies.length) {
      recoDiv.innerHTML = `
        <div id="reco-section" style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px;">
          <h2 style="color: #e50914;">Suggestions</h2>
          <p class="empty-message">Aucune recommandation disponible pour le moment.</p>
        </div>
      `;
      return;
    }

    if (movies[0].info) {
        // Si le backend a envoyé une info (ex: "Similaire à Batman" ou "Basé sur Action")
        titreDynamique = movies[0].info; 
    }

    // 2. On utilise "=" ici, mais ça ne videra QUE la zone "reco-container"
    // Le reste de ta page (films favoris, menu) restera intact.
    let html = `
        <div id="reco-section" style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px;">
            <h2 style="color: #e50914;">${titreDynamique}</h2>
            <div class="movies-grid" style="display: flex; gap: 20px; overflow-x: auto; padding: 20px 0;">
    `;

    movies.forEach(m => {
        const movieData = {
            id: m.id,
            tmdb_id: m.tmdb_id || m.id,
            title: m.title,
            image_url: m.poster_path || m.image_url,
            rating: m.vote_average || m.rating,
            description: m.overview || m.description || "",
            year: m.year || "",
            genre: m.genre || m.genres || "",
            trailer_url: m.trailer_url || "",
            info: ""//m.info || ""
        };
        const movieString = JSON.stringify(movieData).replace(/"/g, '&quot;');

        html += `
            <div class="card" onclick="showMovie(${movieString})" style="min-width: 180px; cursor: pointer;">
                ${renderMovieCard(movieData)}
            </div>
        `;
    });

    html += `</div></div>`;
    
    // 3. Mise à jour de la zone dédiée uniquement
    recoDiv.innerHTML = html; 
}

async function loadFilters() {
  const genreFilter = document.getElementById("genreFilter");
  if (!genreFilter) return;

  genreFilter.innerHTML = `<option value="">Tous les genres</option>`;

  try {
    const res = await fetch(`${API_URL}/movies/filters`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const genres = Array.isArray(data.genres) ? data.genres : [];

    if (!genres.length) {
      await loadFiltersFromMovies();
      return;
    }

    genres.forEach(genre => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      genreFilter.appendChild(option);
    });
  } catch (error) {
    console.error("Erreur filtres:", error);
    await loadFiltersFromMovies();
  }
}

async function loadFiltersFromMovies() {
  const genreFilter = document.getElementById("genreFilter");
  if (!genreFilter) return;

  try {
    const res = await fetch(`${API_URL}/movies?limit=100&offset=0`);
    const movies = await res.json();
    const genres = new Set();

    movies.forEach(movie => {
      (movie.genre || "").split(",").forEach(genre => {
        const cleaned = genre.trim();
        if (cleaned) genres.add(cleaned);
      });
    });

    [...genres].sort().forEach(genre => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      genreFilter.appendChild(option);
    });
  } catch (error) {
    console.error("Fallback filtres impossible:", error);
  }
}

async function resetAndLoadMovies() {
  offset = 0;
  const container = document.getElementById("movies");
  if (container) container.innerHTML = "";
  await loadMovies();
}

async function showView(viewName) {
  const user = localStorage.getItem("userConnected");
  currentView = viewName;

  if (!user && viewName !== "catalog") {
    window.location.href = "login.html";
    return;
  }


  const movieView = document.getElementById("movieView");
  if (movieView) movieView.classList.add("hidden");
  
  const iframe = document.getElementById("trailerIframe");
  if (iframe) iframe.src = "";

  document.querySelectorAll(".app-view").forEach(view => view.classList.add("hidden"));
  
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  const searchFilters = document.getElementById("searchFilters");
  if (searchFilters) searchFilters.classList.toggle("hidden", viewName !== "catalog");


  if (viewName === "catalog") {
    document.getElementById("catalogView").classList.remove("hidden");
  }

  if (viewName === "favorites") {
    document.getElementById("favoritesView").classList.remove("hidden");
    await chargerFavoris("homeFavs");
  }

  if (viewName === "recommendations") {
    document.getElementById("recommendationsView").classList.remove("hidden");
    await chargerRecommendations("homeRecoContainer");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Page LOGIN
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.onsubmit = connecter;

  // Page DASHBOARD
  if (document.getElementById("favs")) {
    chargerDashboard();
    document.getElementById('logoutBtn').onclick = () => {
      localStorage.removeItem('userConnected');
      window.location.href = "index.html";
    };
  }

  // Page ACCUEIL
  if (document.getElementById("movies")) {
    loadFilters();
    loadMovies();
    document.getElementById("loadMore").onclick = loadMovies;
    document.getElementById("search").oninput = resetAndLoadMovies;
    document.getElementById("genreFilter").onchange = resetAndLoadMovies;
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.onclick = () => showView(btn.dataset.view);
    });
  }

  // BOUTONS COMMUNS
  if (document.getElementById("backBtn")) document.getElementById("backBtn").onclick = goHome;
  if (document.getElementById("loginBtn")) document.getElementById("loginBtn").onclick = () => window.location.href="login.html";
  updateNavbar();
});
