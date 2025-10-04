import express from "express";
import cors from "cors";
import morgan from "morgan";
import "./config/db.js"; // Conectar a la base de datos
import habitatRoutes from "./routes/habitat.routes.js";
import floraFaunaRoutes from "./routes/Fauna_Flora.routes.js";
import usuarioRoutes from "./routes/usuario.routes.js";


const app = express();


// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Rutas
app.use("/api/habitats", habitatRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/fauna-flora", floraFaunaRoutes );


// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor" });
});

export default app;