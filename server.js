const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// allow JSON data
app.use(express.json());

// serve your frontend (HTML/CSS/JS)
app.use(express.static(path.join(__dirname)));

// test API route
app.get("/api", (req, res) => {
  res.json({ message: "Backend is working 🚀" });
});

// sample trips API (fake data for now)
app.get("/api/trips", (req, res) => {
  res.json([
    { id: 1, destination: "Paris", budget: 3000 },
    { id: 2, destination: "Tokyo", budget: 4500 }
  ]);
});

// start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});