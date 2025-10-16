import express from "express";
const router = express.Router();

import {
  createAvistamiento,
  getAvistamientos,
  getAvistamientoById,
  deleteAvistamiento,
  addComentario,
  getFrequentZones,
  votarValidacion,
  validarPorExperto,
  obtenerEstadoValidacion,
} from "../controllers/fauna_flora.controller.js";

// Autor: Leonel Torres
// Fecha: 2025-10-03
// Descripción: Rutas para manejar las operaciones CRUD de Fauna y Flora


router.get("/frequent-zones", getFrequentZones);

// CRUD de los avistamientos
router.post("/", createAvistamiento);
router.get("/", getAvistamientos);
router.get("/:id", getAvistamientoById);
router.delete("/:id", deleteAvistamiento);

// Rutas para la validación de especies
router.put("/:id/votar", votarValidacion);
router.put("/:id/validar-experto", validarPorExperto);
router.get("/:id/validacion", obtenerEstadoValidacion);

// Creación de los comentarios
router.post("/:id/comentarios", addComentario);

export default router;
