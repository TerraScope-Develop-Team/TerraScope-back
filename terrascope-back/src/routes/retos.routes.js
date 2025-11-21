import express from "express";
import {
  obtenerRetosActivos,
  obtenerRetoById,
  inscribirseReto,
  desinscribirseReto,
  obtenerTablaPosiciones,
  obtenerLogrosUsuario,
  toggleMostrarLogro,
  obtenerProgresoReto,
  crearRetoManual
} from "../controllers/retos.controller.js";

const router = express.Router();

// Obtener todos los retos activos
router.get("/activos", obtenerRetosActivos);

// Obtener reto por ID
router.get("/:id", obtenerRetoById);

// Inscribirse a un reto
router.post("/inscribirse", inscribirseReto);

// Desinscribirse de un reto
router.post("/desinscribirse", desinscribirseReto);

// Obtener tabla de posiciones
router.get("/:retoId/posiciones", obtenerTablaPosiciones);

// Obtener logros de un usuario
router.get("/usuario/:usuarioId/logros", obtenerLogrosUsuario);

// Cambiar visibilidad de logro
router.patch("/logro/visibilidad", toggleMostrarLogro);

// Obtener progreso en un reto
router.get("/:retoId/progreso/:usuarioId", obtenerProgresoReto);

// Crear reto manual (admin)
router.post("/crear", crearRetoManual);

export default router;
