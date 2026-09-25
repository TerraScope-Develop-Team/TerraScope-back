import express from "express";
const router = express.Router();

import {
  createAvistamiento,
  getAvistamientos,
  getAvistamientoById,
  deleteAvistamiento,
  addComentario,
  deleteComentario,
  toggleLikeAvistamiento,
  getFeedAvistamientos,
  getFrequentZones,
  votarValidacion,
  validarPorExperto,
  obtenerEstadoValidacion,
  getAvistamientosCercanos,
  getAvistamientosPorEspecie,
  getAvistamientosPorUsuario,
  updateAvistamiento,
} from "../controllers/fauna_flora.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.middleware.js";

// Autor: Leonel Torres
// Descripción: Rutas para manejar las operaciones CRUD e interacciones sociales de Fauna y Flora

// Rutas estáticas antes de /:id
router.get("/feed", getFeedAvistamientos);
router.get("/frequent-zones", getFrequentZones);
router.get("/cerca/:latitud/:longitud/:distanciaKm", getAvistamientosCercanos);
router.get("/especie/:especie", getAvistamientosPorEspecie);
router.get("/usuario/:nombreUsuario", getAvistamientosPorUsuario);

// CRUD de los avistamientos
router.post("/", authenticate, createAvistamiento);
router.get("/", getAvistamientos);

// Interacciones sociales (Likes y Comentarios)
router.post("/:id/like", authenticate, toggleLikeAvistamiento);
router.put("/:id/like", authenticate, toggleLikeAvistamiento); // Alias flexible
router.post("/:id/comentarios", authenticate, addComentario);
router.delete("/:id/comentarios/:comentarioId", authenticate, deleteComentario);

// Rutas para la validación de especies
router.put("/:id/votar", authenticate, votarValidacion);
router.put("/:id/validar-experto", authenticate, requireRoles("Administrador", "Investigador"), validarPorExperto);
router.get("/:id/validacion", authenticate, obtenerEstadoValidacion);

// Consulta, actualización y eliminación por ID
router.get("/:id", getAvistamientoById);
router.put("/:id", authenticate, updateAvistamiento);
router.delete("/:id", authenticate, deleteAvistamiento);

export default router;
