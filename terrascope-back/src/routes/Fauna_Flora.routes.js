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
  getAvistamientosCercanos,
  getAvistamientosPorEspecie,
  getAvistamientosPorUsuario,
  updateAvistamiento,
} from "../controllers/fauna_flora.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.middleware.js";

// Autor: Leonel Torres
// Fecha: 2025-10-03
// Descripción: Rutas para manejar las operaciones CRUD de Fauna y Flora


router.get("/frequent-zones", getFrequentZones);
router.get("/cerca/:latitud/:longitud/:distanciaKm", getAvistamientosCercanos);
router.get("/especie/:especie", getAvistamientosPorEspecie);
router.get("/usuario/:nombreUsuario", getAvistamientosPorUsuario);

// CRUD de los avistamientos
router.post("/", authenticate, createAvistamiento);
router.get("/", getAvistamientos);
router.get("/:id", getAvistamientoById);
router.put("/:id", authenticate, updateAvistamiento);
router.delete("/:id", authenticate, deleteAvistamiento);

// Rutas para la validación de especies
router.put("/:id/votar", authenticate, votarValidacion);
router.put("/:id/validar-experto", authenticate, requireRoles("Administrador", "Investigador"), validarPorExperto);
router.get("/:id/validacion", authenticate, obtenerEstadoValidacion);

// Creación de los comentarios
router.post("/:id/comentarios", authenticate, addComentario);

export default router;
