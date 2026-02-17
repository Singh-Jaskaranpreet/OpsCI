const express = require("express");
const cors = require("cors"); 

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors()); 


// Charger les données des films directement avec require
const movies = require("./movies.json"); // On suppose que movies.json est dans le même répertoire

// Route simple pour dire "Hello World"
app.get("/hello", (req, res) => {
  res.json({ message: "Hello World" });
});

// Route pour récupérer les films avec possibilité de limite
app.get("/movies", (req, res)  => {
  const data = require("./movies.json")
  const limit = parseInt(req.query.limit);
  let result = movies;

  if (!isNaN(limit)) {
    result = movies.slice(0, limit);
  }
})

app.use('/images', express.static('images'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});