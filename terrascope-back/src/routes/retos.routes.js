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
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /retos/activos:
 *   get:
 *     summary: Obtener todos los retos activos
 *     tags: [Retos]
 *     responses:
 *       200:
 *         description: Lista de retos activos
 */
router.get("/activos", obtenerRetosActivos);

/**
 * @swagger
 * /retos/{id}:
 *   get:
 *     summary: Obtener reto por ID
 *     tags: [Retos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Reto obtenido
 */
router.get("/:id", obtenerRetoById);

/**
 * @swagger
 * /retos/inscribirse:
 *   post:
 *     summary: Inscribirse a un reto
 *     tags: [Retos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [retoId]
 *             properties:
 *               retoId:
 *                 type: string
 *                 description: ID MongoDB del reto
 *     responses:
 *       200:
 *         description: Inscripción confirmada y persistida; usuario derivado del JWT
 *       401:
 *         description: Token ausente o usuario no autenticado
 *       404:
 *         description: Reto o usuario no encontrado
 */
router.post("/inscribirse", verificarToken, inscribirseReto);

/**
 * @swagger
 * /retos/desinscribirse:
 *   post:
 *     summary: Desinscribirse de un reto
 *     tags: [Retos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Desinscripción exitosa
 */
router.post("/desinscribirse", verificarToken, desinscribirseReto);

/**
 * @swagger
 * /retos/{retoId}/posiciones:
 *   get:
 *     summary: Obtener tabla de posiciones
 *     tags: [Retos]
 *     parameters:
 *       - in: path
 *         name: retoId
 *         required: true
 *     responses:
 *       200:
 *         description: Tabla de posiciones
 */
router.get("/:retoId/posiciones", obtenerTablaPosiciones);

/**
 * @swagger
 * /retos/usuario/{usuarioId}/logros:
 *   get:
 *     summary: Obtener logros de un usuario
 *     tags: [Retos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de logros
 */
router.get("/usuario/:usuarioId/logros", verificarToken, obtenerLogrosUsuario);

/**
 * @swagger
 * /retos/logro/visibilidad:
 *   patch:
 *     summary: Cambiar visibilidad de logro
 *     tags: [Retos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visibilidad cambiada
 */
router.patch("/logro/visibilidad", verificarToken, toggleMostrarLogro);

/**
 * @swagger
 * /retos/{retoId}/progreso/{usuarioId}:
 *   get:
 *     summary: Obtener progreso en un reto
 *     tags: [Retos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: retoId
 *         required: true
 *       - in: path
 *         name: usuarioId
 *         required: true
 *     responses:
 *       200:
 *         description: Progreso del usuario
 */
router.get("/:retoId/progreso/:usuarioId", verificarToken, obtenerProgresoReto);

/**
 * @swagger
 * /retos/crear:
 *   post:
 *     summary: Crear reto manual (admin)
 *     tags: [Retos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Reto creado
 */
router.post("/crear", verificarToken, crearRetoManual);

export default router;
