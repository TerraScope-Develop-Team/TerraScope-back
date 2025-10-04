import express from "express";
import cors from "cors";
import morgan from "morgan";
import "./config/db.js"; // Conectar a la base de datos

const app = express();

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({ 
    message: "¡TerraScope Backend funcionando!",
    status: "OK"
  });
});

// Ruta de salud
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK",
    database: "Connected", 
    environment: process.env.NODE_ENV || "development"
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor" });
});

export default app;