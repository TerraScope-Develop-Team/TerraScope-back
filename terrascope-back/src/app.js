import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import "dotenv/config";
import "./config/db.js";
import habitatRoutes from "./routes/habitat.routes.js";
import floraFaunaRoutes from "./routes/Fauna_Flora.routes.js";
import usuarioRoutes from "./routes/usuario.routes.js";
import iaRoutes from "./routes/ia.routes.js";
import retosRoutes from "./routes/retos.routes.js";
import alertaRoutes from "./routes/alerta.routes.js";
import notificacionRoutes from "./routes/notificacion.routes.js";
import retosService from "./services/retos.service.js";
import { iniciarProgramadorNotificaciones } from "./services/notification-scheduler.service.js";

import { setupSwagger } from "./config/swagger.js";

const app = express();

// Configurar Swagger
setupSwagger(app);

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Rutas
app.use("/api/habitats", habitatRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/fauna-flora", floraFaunaRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api/retos", retosRoutes);
app.use("/api/alertas", alertaRoutes);
app.use("/api/notificaciones", notificacionRoutes);

iniciarProgramadorNotificaciones();

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor" });
});

export default app;
