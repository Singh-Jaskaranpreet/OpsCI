document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("studentForm").addEventListener("submit", function(event) {
        event.preventDefault();

        // Récupérer les valeurs des champs
        let name = document.getElementById("name").value;
        let dob = document.getElementById("dob").value;
        let email = document.getElementById("email").value;
        let bio = document.getElementById("bio").value;
        let skills = document.getElementById("skills").value;
        let linkedin = document.getElementById("linkedin").value;

        // Affichage des informations dans la section profil
        document.getElementById("displayName").textContent = name;
        document.getElementById("displayDob").textContent = dob;
        document.getElementById("displayEmail").textContent = email;
        document.getElementById("displayBio").textContent = bio;
        document.getElementById("displaySkills").textContent = skills;
        
        let linkedinLink = document.getElementById("displayLinkedin");
        linkedinLink.href = linkedin;
        linkedinLink.textContent = linkedin ? "Voir le profil" : "Aucun lien fourni";
    });
});
