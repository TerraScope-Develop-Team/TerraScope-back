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
  getFeedAvistamientos,
  toggleLikeAvistamiento,
  deleteComentario,
} from "../controllers/fauna_flora.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

// Autor: Leonel Torres
// Fecha: 2025-10-03
// Descripción: Rutas para manejar las operaciones CRUD de Fauna y Flora


/**
 * @swagger
 * /fauna-flora/feed:
 *   get:
 *     summary: Obtener feed de avistamientos de usuarios seguidos
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed de avistamientos
 */
router.get("/feed", verificarToken, getFeedAvistamientos);

/**
 * @swagger
 * /fauna-flora/frequent-zones:
 *   get:
 *     summary: Obtener zonas frecuentes
 *     tags: [Fauna y Flora]
 *     responses:
 *       200:
 *         description: Lista de zonas frecuentes
 */
router.get("/frequent-zones", getFrequentZones);

/**
 * @swagger
 * /fauna-flora:
 *   post:
 *     summary: Crear un avistamiento
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Avistamiento creado
 *   get:
 *     summary: Obtener todos los avistamientos
 *     tags: [Fauna y Flora]
 *     responses:
 *       200:
 *         description: Lista de avistamientos
 */
router.post("/", verificarToken, createAvistamiento);
router.get("/", getAvistamientos);

/**
 * @swagger
 * /fauna-flora/{id}:
 *   get:
 *     summary: Obtener avistamiento por ID
 *     tags: [Fauna y Flora]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Avistamiento encontrado
 *   delete:
 *     summary: Eliminar avistamiento
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Avistamiento eliminado
 */
router.get("/:id", getAvistamientoById);
router.delete("/:id", verificarToken, deleteAvistamiento);

/**
 * @swagger
 * /fauna-flora/{id}/votar:
 *   put:
 *     summary: Votar validación
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Voto registrado
 */
router.put("/:id/votar", verificarToken, votarValidacion);

/**
 * @swagger
 * /fauna-flora/{id}/validar-experto:
 *   put:
 *     summary: Validar por experto
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Validación registrada
 */
router.put("/:id/validar-experto", verificarToken, validarPorExperto);

/**
 * @swagger
 * /fauna-flora/{id}/validacion:
 *   get:
 *     summary: Obtener estado de validación
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Estado obtenido
 */
router.get("/:id/validacion", verificarToken, obtenerEstadoValidacion);

/**
 * @swagger
 * /fauna-flora/{id}/comentarios:
 *   post:
 *     summary: Agregar comentario
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Comentario agregado
 */
router.post("/:id/comentarios", verificarToken, addComentario);

/**
 * @swagger
 * /fauna-flora/{id}/comentarios/{comentarioId}:
 *   delete:
 *     summary: Eliminar comentario
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       - in: path
 *         name: comentarioId
 *         required: true
 *     responses:
 *       200:
 *         description: Comentario eliminado
 */
router.delete("/:id/comentarios/:comentarioId", verificarToken, deleteComentario);

/**
 * @swagger
 * /fauna-flora/{id}/like:
 *   post:
 *     summary: Dar o quitar like
 *     tags: [Fauna y Flora]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Like alternado
 */
router.post("/:id/like", verificarToken, toggleLikeAvistamiento);
router.put("/:id/like", verificarToken, toggleLikeAvistamiento); // Alias flexible

export default router;
