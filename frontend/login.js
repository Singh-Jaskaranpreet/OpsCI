// Gérer la soumission du formulaire
document.getElementById("loginForm").addEventListener("submit", function(event) {
  event.preventDefault();  // Empêche la soumission classique du formulaire

  // Récupérer les valeurs des champs
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  // Envoi des informations de connexion à l'API
  fetch("http://localhost:8000/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username: username, password: password }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Connexion réussie
      alert("Connexion réussie !");
      window.localStorage.setItem("token", data.token);  // Stocke le token JWT dans le localStorage
      window.location.href = "/dashboard";  // Redirection vers la page principale
    } else {
      // Afficher un message d'erreur
      document.getElementById("error-message").innerText = "Nom d'utilisateur ou mot de passe incorrect.";
    }
  })
  .catch(error => {
    console.error("Erreur de connexion :", error);
    document.getElementById("error-message").innerText = "Une erreur est survenue. Veuillez réessayer.";
  });
});