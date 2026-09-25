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
} from "../controllers/fauna_flora.controller.js";

// Autor: Leonel Torres
// Descripción: Rutas para manejar las operaciones CRUD e interacciones sociales de Fauna y Flora

// Rutas estáticas antes de /:id
router.get("/feed", getFeedAvistamientos);
router.get("/frequent-zones", getFrequentZones);

// CRUD de avistamientos
router.post("/", createAvistamiento);
router.get("/", getAvistamientos);

// Interacciones sociales (Likes y Comentarios)
router.post("/:id/like", toggleLikeAvistamiento);
router.put("/:id/like", toggleLikeAvistamiento); // Alias flexible para frontend
router.post("/:id/comentarios", addComentario);
router.delete("/:id/comentarios/:comentarioId", deleteComentario);

// Rutas para la validación de especies
router.put("/:id/votar", votarValidacion);
router.put("/:id/validar-experto", validarPorExperto);
router.get("/:id/validacion", obtenerEstadoValidacion);

// Consulta y eliminación por ID
router.get("/:id", getAvistamientoById);
router.delete("/:id", deleteAvistamiento);

export default router;

