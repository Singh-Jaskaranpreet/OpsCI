/* --- CONFIGURATION GLOBALE --- */
// URL du point d'entrée unique (API Gateway / Proxy Backend)
const API_URL = "/api";

let offset = 0; // Index de départ pour la pagination des films
const LIMIT = 14; // Nombre de films à charger par requête
let currentView = "catalog"; // État global pour la navigation Single Page (SPA)

/**
 * COUCHE LOGIQUE : GESTION DES REQUÊTES
 * Prépare les paramètres de filtrage pour l'API
 */
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

/**
 * COUCHE LOGIQUE : COMMUNICATION BACKEND
 * Charge les films depuis le service principal (Port 8000)
 */
async function loadMovies() {
  try {
    const res = await fetch(`${API_URL}/movies?${getMovieQueryParams()}`);
    const movies = await res.json();

    if (!movies.length) {
      console.log("Plus de films");
      return;
    }

    displayMovies(movies); // Appel de la couche présentation
    offset += LIMIT; // Incrémentation pour le prochain chargement

  } catch (error) {
    console.error("Erreur:", error);
  }
}

/**
 * COUCHE PRÉSENTATION : TEMPLATING
 * Génère le HTML pour une carte de film (utilisé partout dans l'app)
 */
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

/**
 * COUCHE PRÉSENTATION : RÉSEAU DE GRILLE
 * Affiche les films dans le catalogue principal
 */
function displayMovies(movies) {
  const container = document.getElementById("movies");
  if (!container) return;

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = renderMovieCard(movie);

    card.onclick = () => showMovie(movie); // Navigation vers le détail
    container.appendChild(card);
  });
}

/**
 * FONCTION PRINCIPALE : VUE DÉTAILLÉE
 * Orchestre les appels multi-services (Data, Trailer, Recommandations)
 */
async function showMovie(movie) {
  const movieView = document.getElementById("movieView");
  const recoContainer = document.getElementById("reco-container");
  const searchFilters = document.getElementById("searchFilters");

  // Logique SPA : Masquage des vues et nettoyage
  document.querySelectorAll(".app-view").forEach(view => view.classList.add("hidden"));
  if (searchFilters) searchFilters.classList.add("hidden");
  if (movieView) movieView.classList.remove("hidden");
  if (recoContainer) recoContainer.innerHTML = "";

  // Mise à jour de la couche présentation avec les données reçues
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

  // Vérification synchrone de l'état des favoris (Backend 8000)
  if (username && favContainer) {
    const checkRes = await fetch(`${API_URL}/favorites/check?username=${username}&movie_id=${movie.tmdb_id}`);
    const checkData = await checkRes.json();

    const btn = document.createElement("button");

    if (checkData.is_favorite) {
      btn.innerText = "❤️ Dans tes favoris";
      btn.style.backgroundColor = "#e50914"; 
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

  // Récupération du Trailer via l'API Data
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

  /**
   * COMMUNICATION INTER-SERVICES
   * On appelle le Proxy Backend (8000) qui contacte le service Reco (8001)
   */
  try {
      const res = await fetch(`${API_URL}/movies/${movie.tmdb_id}/recommendations`);
      const data = await res.json();

      if (data.recommendations) {
          afficherLesSuggestions(data.recommendations);
      }
  } catch (e) {
      console.error("Erreur via le proxy backend:", e);
  }
}

/**
 * GESTION DE LA NAVIGATION
 * Réinitialise l'interface vers l'état catalogue
 */
function goHome() {
  document.getElementById("movieView").classList.add("hidden");

  const iframe = document.getElementById("trailerIframe");
  if (iframe) {
    iframe.src = "";
    iframe.classList.add("hidden");
  }

  document.querySelectorAll('.app-view').forEach(view => view.classList.add('hidden'));
  
  const catalog = document.getElementById("catalogView");
  if (catalog) catalog.classList.remove("hidden");

  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const catalogBtn = document.querySelector('[data-view="catalog"]');
  if (catalogBtn) catalogBtn.classList.add('active');

  document.getElementById("searchFilters").classList.remove("hidden");
  document.getElementById("loadMore").classList.remove("hidden");
}

/**
 * COUCHE LOGIQUE : ACTIONS UTILISATEUR (FAVORIS)
 */
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
    
    if (res.ok) {
      const favContainer = document.getElementById("favContainer");
      const btn = favContainer.querySelector("button");
      if (btn) {
        btn.innerText = "❤️ Dans tes favoris";
        btn.style.backgroundColor = "#e50914";
      }
      await refreshHomeUserSections();
    }
  } catch (err) {
    console.error("Erreur:", err);
  }
}

/**
 * AUTHENTIFICATION & NAVBAR
 * Gère l'affichage dynamique des menus (Connexion/Déconnexion)
 */
function updateNavbar() {
    const user = localStorage.getItem('userConnected');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('dashboardBtn');

    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (logoutBtn) {
            logoutBtn.classList.remove('hidden');
            logoutBtn.innerText = `Se déconnecter (${user})`;
            logoutBtn.onclick = () => {
              localStorage.removeItem('userConnected');
              window.location.href = "index.html";
            };
        }
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }
}

// Inscription (Requête vers service Data)
async function sinscrire() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const formData = new FormData();
    formData.append('username', u);
    formData.append('password', p);

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            body: formData 
        });
        if (res.ok) {
            alert("Compte créé !");
            window.location.href = "login.html";
        }
    } catch (err) {
        alert("Serveur injoignable");
    }
}

// Connexion (Stockage LocalStorage pour persistance)
async function connecter(event) {
    if (event) event.preventDefault();
    const u = document.getElementById("username").value;
    const p = document.getElementById("password").value;

    const formData = new FormData();
    formData.append('username', u);
    formData.append('password', p);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();

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

// Helper : Transition entre les sections sans rechargement
async function chargerEtAfficher(movieId) {
    const res = await fetch(`${API_URL}/movies/${movieId}`);
    const movieData = await res.json();
    showMovie(movieData);
}

// Rafraîchissement asynchrone des vues Favoris/Reco lors d'un changement d'onglet
async function refreshHomeUserSections() {
  const movieView = document.getElementById("movieView");
  const user = localStorage.getItem("userConnected");

  if (!user || (movieView && !movieView.classList.contains("hidden"))) return;

  if (currentView === "favorites") await chargerFavoris("homeFavs");
  if (currentView === "recommendations") await chargerRecommendations("homeRecoContainer");
}

// Chargement des favoris via le service Data
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

// Chargement des recommandations via le Proxy (Contacte le Micro-service 8001)
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

/**
 * COUCHE PRÉSENTATION : SYSTÈME DE RECOMMANDATIONS
 * Affiche la grille de suggestions avec titre dynamique (ex: 'Similaire à...')
 */
function afficherLesSuggestions(movies, containerId = "reco-container") {
    let recoDiv = document.getElementById(containerId);
    if (!recoDiv) return;
    let titreDynamique = "Suggestions pour vous"; 

    if (!movies.length) {
      recoDiv.innerHTML = `<p class="empty-message">Aucune recommandation pour le moment.</p>`;
      return;
    }

    if (movies[0].info) titreDynamique = movies[0].info; 

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
            info: ""
        };
        const movieString = JSON.stringify(movieData).replace(/"/g, '&quot;');
        html += `
            <div class="card" onclick="showMovie(${movieString})" style="min-width: 180px; cursor: pointer;">
                ${renderMovieCard(movieData)}
            </div>
        `;
    });

    html += `</div></div>`;
    recoDiv.innerHTML = html; 
}

/**
 * FILTRES DYNAMIQUES
 * Récupère les catégories existantes depuis la base de données
 */
async function loadFilters() {
  const genreFilter = document.getElementById("genreFilter");
  if (!genreFilter) return;
  genreFilter.innerHTML = `<option value="">Tous les genres</option>`;
  try {
    const res = await fetch(`${API_URL}/movies/filters`);
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

// Fallback : Génère les filtres à partir des films déjà chargés si l'endpoint filters échoue
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

// Remise à zéro pour une nouvelle recherche
async function resetAndLoadMovies() {
  offset = 0;
  const container = document.getElementById("movies");
  if (container) container.innerHTML = "";
  await loadMovies();
}

/**
 * SYSTÈME DE NAVIGATION (SPA)
 * Bascule l'affichage entre Catalogue, Favoris et Recommandations
 */
async function showView(viewName) {
  const user = localStorage.getItem("userConnected");
  currentView = viewName;

  const iframe = document.getElementById("trailerIframe");
  if (iframe) {
    iframe.src = "";
    iframe.classList.add("hidden");
  }

  if (!user && viewName !== "catalog") {
    window.location.href = "login.html";
    return;
  }

  // Masquage global
  document.getElementById("movieView").classList.add("hidden");
  document.querySelectorAll(".app-view").forEach(view => view.classList.add("hidden"));
  
  // Gestion de l'état "actif" sur les boutons de navigation
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
  
  if (document.getElementById("searchFilters")) {
    document.getElementById("searchFilters").classList.toggle("hidden", viewName !== "catalog");
  }

  // Affichage de la section demandée
  if (viewName === "catalog") document.getElementById("catalogView").classList.remove("hidden");
  if (viewName === "favorites") {
    document.getElementById("favoritesView").classList.remove("hidden");
    await chargerFavoris("homeFavs");
  }
  if (viewName === "recommendations") {
    document.getElementById("recommendationsView").classList.remove("hidden");
    await chargerRecommendations("homeRecoContainer");
  }
}

/**
 * INITIALISATION
 * Point d'entrée principal au chargement de la page
 */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById("loginForm")) {
    document.getElementById("loginForm").onsubmit = connecter;
  }

  // Si on est sur la page principale avec la grille de films
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

  // Liaisons des boutons statiques
  if (document.getElementById("backBtn")) document.getElementById("backBtn").onclick = goHome;
  if (document.getElementById("loginBtn")) document.getElementById("loginBtn").onclick = () => window.location.href="login.html";
  
  updateNavbar(); // Vérification de l'état de session
});

if (typeof module !== 'undefined') {
  module.exports = { 
    getMovieQueryParams, 
    renderMovieCard, 
    updateNavbar, 
    afficherLesSuggestions,
    goHome,
    retirerDesFavoris
  };
}