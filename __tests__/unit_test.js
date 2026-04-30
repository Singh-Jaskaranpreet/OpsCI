/**
 * @jest-environment jsdom
 */

// Importation de toutes les fonctions exportées depuis ton script
const { 
  getMovieQueryParams, 
  renderMovieCard, 
  updateNavbar, 
  afficherLesSuggestions,
  goHome,
  retirerDesFavoris
} = require('../frontend/script.js');

describe('SUITE DE TESTS COMPLÈTE - FRONTEND LOGIC', () => {

  // --- CONFIGURATION DU DOM ---
  beforeEach(() => {
    // Reconstruction complète du DOM nécessaire pour toutes les fonctions
    document.body.innerHTML = `
      <div id="navbar">
        <button id="loginBtn"></button>
        <button id="dashboardBtn" class="hidden"></button>
      </div>
      <div id="searchSection">
        <input id="search" value="">
        <select id="genreFilter">
            <option value="">Tous les genres</option>
            <option value="Sci-Fi">Sci-Fi</option>
        </select>
      </div>
      <div id="movies"></div>
      <div id="movieView" class="app-view hidden">
        <h2 id="title"></h2>
        <p id="genre"></p>
        <p id="year"></p>
        <p id="rating"></p>
        <p id="desc"></p>
        <img id="movieImage" src="">
        <div id="favContainer"></div>
        <iframe id="trailerIframe" src="about:blank"></iframe>
      </div>
      <div id="catalogView" class="app-view"></div>
      <div id="searchFilters"></div>
      <div id="loadMore"></div>
      <div id="reco-container"></div>
    `;
    localStorage.clear();
    jest.clearAllMocks();
  });

  // --- 1. TESTS DE NAVIGATION & API ---
  describe('Pilier 1 : Logique de requête (API)', () => {
    test('doit inclure limit=14 et offset par défaut', () => {
      const params = getMovieQueryParams();
      expect(params).toContain('limit=14');
      expect(params).toContain('offset=0');
    });

    test('doit ajouter le filtre de genre dans l\'URL si sélectionné', () => {
      const genreSelect = document.getElementById('genreFilter');
      genreSelect.value = 'Sci-Fi'; // Simulation du choix utilisateur
      
      const paramsString = getMovieQueryParams();
      const params = new URLSearchParams(paramsString);
      
      expect(params.get('genre')).toBe('Sci-Fi');
    });
  });

  // --- 2. TESTS DE RENDU (TEMPLATING) ---
  describe('Pilier 2 : Rendu des composants (UI)', () => {
    test('renderMovieCard doit gérer l\'absence de poster', () => {
      const movie = { title: 'Dune' }; // Pas de image_url
      const html = renderMovieCard(movie);
      expect(html).toContain('src=""'); // Vérifie qu'il n'y a pas "undefined"
      expect(html).toContain('Dune');
    });

    test('renderMovieCard doit afficher le badge de recommandation si présent', () => {
      const html = renderMovieCard({ title: 'A' }, { info: '90% Match' });
      expect(html).toContain('reco-info');
      expect(html).toContain('90% Match');
    });
  });

  // --- 3. TESTS DE SÉCURITÉ & SESSION ---
  describe('Pilier 3 : Gestion de l\'état (Sécurité)', () => {
    test('updateNavbar doit afficher le pseudo de l\'utilisateur connecté', () => {
      localStorage.setItem('userConnected', 'Admin_Singh');
      updateNavbar();
      const logoutBtn = document.getElementById('dashboardBtn');
      expect(logoutBtn.innerText).toContain('Admin_Singh');
      expect(logoutBtn.classList.contains('hidden')).toBe(false);
    });
  });

  // --- 4. TESTS DE RÉSILIENCE (FAIL-SOFT) ---
  describe('Pilier 4 : Résilience face aux micro-services', () => {
    test('afficherLesSuggestions doit informer l\'utilisateur si le service Reco est vide', () => {
      afficherLesSuggestions([], 'reco-container');
      const container = document.getElementById('reco-container');
      expect(container.innerHTML).toContain('Aucune recommandation pour le moment');
    });

    test('afficherLesSuggestions doit utiliser un titre dynamique basé sur les données', () => {
      const fakeMovies = [{ title: 'Film 1', info: 'Parce que vous avez aimé Batman' }];
      afficherLesSuggestions(fakeMovies, 'reco-container');
      expect(document.getElementById('reco-container').innerHTML).toContain('Parce que vous avez aimé Batman');
    });
  });

  describe('Pilier 5 : Navigation SPA et Nettoyage', () => {
    test('goHome doit réinitialiser l\'affichage et vider l\'iframe du trailer', () => {
        // Préparation du DOM
        document.body.innerHTML = `
        <div id="movieView"></div>
        <div id="catalogView" class="hidden"></div>
        <div id="searchFilters" class="hidden"></div>
        <iframe id="trailerIframe" src="https://youtube.com/video"></iframe>
        `;

        goHome();

        // Vérifications
        expect(document.getElementById('movieView').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('catalogView').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('trailerIframe').src).toBe(""); // Sécurité : stop la vidéo
    });
  });

  describe('Pilier 6 : Actions Utilisateur et Protections', () => {
    test('retirerDesFavoris doit bloquer l\'action si l\'utilisateur n\'est pas connecté', () => {
        // On s'assure que le localStorage est vide
        localStorage.clear();
        
        // On simule l'alerte du navigateur
        global.alert = jest.fn(); 

        retirerDesFavoris(123);

        // Vérifie que l'alerte a été affichée et que rien n'a été envoyé
        expect(global.alert).toHaveBeenCalledWith("Connecte-toi d'abord !");
    });
  });

});
