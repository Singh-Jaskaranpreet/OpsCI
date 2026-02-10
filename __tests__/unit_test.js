/**
 * @jest-environment jsdom
 */

 global.TextEncoder = require("util").TextEncoder;
 global.TextDecoder = require("util").TextDecoder;
 
 const { JSDOM } = require("jsdom");
 const fs = require("fs");
 const path = require("path");
 
 describe("Form Submission", () => {
     let document, form, window;
 
     beforeEach(() => {
         // Charger le fichier HTML
         const html = fs.readFileSync(path.resolve(__dirname, "../simple_app/index.html"), "utf8");
 
         // Simuler le DOM avec JSDOM
         const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
         document = dom.window.document;
         window = dom.window;
 
         // Charger manuellement le script
         const scriptPath = path.resolve(__dirname, "../simple_app/script.js");
         const scriptContent = fs.readFileSync(scriptPath, "utf8");
         const scriptElement = document.createElement("script");
         scriptElement.textContent = scriptContent;
         document.body.appendChild(scriptElement);
 
         // Récupérer le formulaire
         form = document.getElementById("studentForm");
     });
 
     test("Remplir et soumettre le formulaire met à jour l'affichage", async () => {
         expect(form).not.toBeNull(); // Vérifier que le formulaire existe
 
         document.getElementById("name").value = "Bob Alice";
         document.getElementById("dob").value = "1990-01-01";
         document.getElementById("email").value = "Bob_alice@example.com";
         document.getElementById("bio").value = "Développeur passionné.";
         document.getElementById("skills").value = "JavaScript, React";
         document.getElementById("linkedin").value = "https://linkedin.com/in/bob_alice";
 
         // Simuler la soumission du formulaire
         const event = new window.Event("submit", { bubbles: true, cancelable: true });
         form.dispatchEvent(event);
 
         // Attendre la mise à jour du DOM
         await new Promise((resolve) => setTimeout(resolve, 50));
 
         // Vérifier que les champs affichent bien les valeurs soumises
         expect(document.getElementById("displayName").textContent).toBe("Bob Alice");
         expect(document.getElementById("displayDob").textContent).toBe("1990-01-01");
         expect(document.getElementById("displayEmail").textContent).toBe("Bob_alice@example.com");
         expect(document.getElementById("displayBio").textContent).toBe("Développeur passionné.");
         expect(document.getElementById("displaySkills").textContent).toBe("JavaScript, React");
         expect(document.getElementById("displayLinkedin").href).toContain("https://linkedin.com/in/bob_alice");
     });
 });
 