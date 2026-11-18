import express from "express";
import { identificarEspecie, validarRegistroFaunaFlora, getIaStats } from "../controllers/ia.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { iaRateLimiter } from "../middlewares/rate-limit.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /ia/identificar:
 *   post:
 *     summary: Identificar especie mediante IA
 *     tags: [IA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Especie identificada.
 *       429:
 *         description: Límite de solicitudes de IA excedido (10 por minuto). Incluye encabezado Retry-After.
 */
router.post("/identificar", verificarToken, iaRateLimiter, identificarEspecie);

/**
 * @swagger
 * /ia/validar-registro:
 *   post:
 *     summary: Validar registro de fauna/flora mediante IA
 *     tags: [IA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Registro validado.
 *       429:
 *         description: Límite de solicitudes de IA excedido. Incluye encabezado Retry-After.
 */
router.post("/validar-registro", verificarToken, iaRateLimiter, validarRegistroFaunaFlora);

/**
 * @swagger
 * /ia/stats:
 *   get:
 *     summary: Obtener métricas del caché de identificación de imágenes
 *     description: Devuelve contadores de solicitudes totales, hits y misses del caché, tasa de hit y número de entradas activas.
 *     tags: [IA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del caché de IA.
 */
router.get("/stats", verificarToken, getIaStats);

export default router;
