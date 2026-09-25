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
import {
  authenticate,
  requireBodyUserOrAdmin,
  requireParamUserOrAdmin,
  requireRoles
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Obtener todos los retos activos
router.get("/activos", obtenerRetosActivos);

// Obtener reto por ID
router.get("/:id", obtenerRetoById);

// Inscribirse a un reto
router.post("/inscribirse", authenticate, requireBodyUserOrAdmin(), inscribirseReto);

// Desinscribirse de un reto
router.post("/desinscribirse", authenticate, requireBodyUserOrAdmin(), desinscribirseReto);

// Obtener tabla de posiciones
router.get("/:retoId/posiciones", obtenerTablaPosiciones);

// Obtener logros de un usuario
router.get("/usuario/:usuarioId/logros", authenticate, requireParamUserOrAdmin(), obtenerLogrosUsuario);

// Cambiar visibilidad de logro
router.patch("/logro/visibilidad", authenticate, requireBodyUserOrAdmin(), toggleMostrarLogro);

// Obtener progreso en un reto
router.get("/:retoId/progreso/:usuarioId", authenticate, requireParamUserOrAdmin(), obtenerProgresoReto);

// Crear reto manual (admin)
router.post("/crear", authenticate, requireRoles("Administrador"), crearRetoManual);

export default router;
