const API_URL = "http://127.0.0.1:8000";
const RECO_BASE = "http://localhost:8001";

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
  document.getElementById("reco-container").innerHTML = "";

  document.getElementById("title").innerText = movie.title || "No title";
  const genreElem = document.getElementById("genre");
  if (genreElem) {
      genreElem.innerText = "Genre : " + (movie.genre || "Non spécifié");
  }
  
  document.getElementById("year").innerText = movie.year || "";
  document.getElementById("rating").innerText = "⭐ " + (movie.rating || "N/A");
  document.getElementById("desc").innerText = movie.description || "";
  document.getElementById("movieImage").src = movie.image_url || "";
  
  const favContainer = document.getElementById("favContainer");
  const username = localStorage.getItem('userConnected');

  if (username && favContainer) {
    // On demande au Backend si c'est déjà en favori
    const checkRes = await fetch(`${API_URL}/favorites/check?username=${username}&movie_id=${movie.tmdb_id}`);
    const checkData = await checkRes.json();

    favContainer.innerHTML = "";
    const btn = document.createElement("button");

    if (checkData.is_favorite) {
      btn.innerText = "❤️ Dans tes favoris";
      btn.style.backgroundColor = "#e50914"; // Rouge Netflix
      btn.onclick = () => alert("Tu as déjà ce film en favori !");
    } else {
      btn.innerText = "⭐ Ajouter aux favoris";
      btn.onclick = () => ajouterAuxFavoris(movie.tmdb_id, movie.title, movie.image_url);
    }
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

      await fetch(`http://127.0.0.1:8001/update/${user}`, { method: 'POST' });
      // 2. AFFICHAGE DES RECOMMANDATIONS
      if (data.recommendations && data.recommendations.length > 0) {
        afficherLesSuggestions(data.recommendations);
      } else {
        alert("Ajouté avec succès !");
      }
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

    // On vérifie d'abord si les boutons existent sur la page
    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden'); // On ajoute "if (loginBtn)"
        if (dashboardBtn) {
            dashboardBtn.classList.remove('hidden');
            dashboardBtn.innerText = user;
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
            window.location.href = "dashboard.html";
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
    favsContainer.innerHTML = favs.map(f => `
      <div class="card" onclick="chargerEtAfficher(${f.movie_id})">
        <img src="${f.image_url}">
        <h3>${f.title}</h3>
      </div>
    `).join('');
  }

  // 2. Charger les Recommendations
  // On utilise un bloc try/catch pour ne pas bloquer si le port 8001 est éteint
  try {
    const resReco = await fetch(`http://127.0.0.1:8001/update/${user}`, { method: 'POST' });
    const dataReco = await resReco.json();
    if (dataReco.recommendations) {
        afficherLesSuggestions(dataReco.recommendations);
    }
  } catch (e) {
    console.log("Le service de recommandation n'est pas lancé.");
  }
}



async function chargerEtAfficher(movieId) {
    const res = await fetch(`${API_URL}/movies/${movieId}`);
    const movieData = await res.json();
    showMovie(movieData); // Ta fonction existante
}

function afficherLesSuggestions(movies) {
    // 1. On cible l'ID PRÉCIS du container de recommandations
    let recoDiv = document.getElementById("reco-container");
    
    // Si on ne le trouve pas (par exemple sur l'accueil), on ne fait rien 
    // ou on cherche un autre endroit spécifique.
    if (!recoDiv) return;

    // 2. On utilise "=" ici, mais ça ne videra QUE la zone "reco-container"
    // Le reste de ta page (films favoris, menu) restera intact.
    let html = `
        <div id="reco-section" style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px;">
            <h2 style="color: #e50914;">Suggestions pour vous</h2>
            <div class="movies-grid" style="display: flex; gap: 20px; overflow-x: auto; padding: 20px 0;">
    `;

    movies.forEach(m => {
        const movieData = {
            id: m.id,
            tmdb_id: m.id,
            title: m.title,
            image_url: m.poster_path || m.image_url,
            rating: m.vote_average || m.rating,
            description: m.overview || m.description || ""
        };
        const movieString = JSON.stringify(movieData).replace(/"/g, '&quot;');

        html += `
            <div class="card" onclick="showMovie(${movieString})" style="min-width: 180px; cursor: pointer;">
                <img src="${movieData.image_url}" style="width: 100%; border-radius: 8px;">
                <h3 style="font-size: 0.9rem;">${movieData.title}</h3>
            </div>
        `;
    });

    html += `</div></div>`;
    
    // 3. Mise à jour de la zone dédiée uniquement
    recoDiv.innerHTML = html; 
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
    loadMovies();
    document.getElementById("loadMore").onclick = loadMovies;
    document.getElementById("search").oninput = (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll(".card").forEach(card => {
            card.style.display = card.querySelector("h3").innerText.toLowerCase().includes(q) ? "block" : "none";
        });
    };
  }

  // BOUTONS COMMUNS
  if (document.getElementById("backBtn")) document.getElementById("backBtn").onclick = goHome;
  if (document.getElementById("loginBtn")) document.getElementById("loginBtn").onclick = () => window.location.href="login.html";
  if (document.getElementById("dashboardBtn")) document.getElementById("dashboardBtn").onclick = () => window.location.href="dashboard.html";

  updateNavbar();
});