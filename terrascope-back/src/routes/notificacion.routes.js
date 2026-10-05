import express from "express";
import {
  actualizarPreferencias,
  actualizarUbicacionDispositivo,
  eliminarDispositivo,
  obtenerPreferencias,
  registrarDispositivo
} from "../controllers/notificacion.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verificarToken);

/**
 * @swagger
 * /notificaciones/dispositivos:
 *   post:
 *     summary: Registrar o actualizar un token FCM del usuario autenticado
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token de registro FCM del dispositivo
 *               plataforma:
 *                 type: string
 *                 example: android
 *               latitud:
 *                 type: number
 *               longitud:
 *                 type: number
 *               precision_ubicacion_m:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Dispositivo registrado
 *       400:
 *         description: Token, plataforma o ubicación inválidos
 */
router.post("/dispositivos", registrarDispositivo);

/**
 * @swagger
 * /notificaciones/dispositivos/ubicacion:
 *   patch:
 *     summary: Actualizar ubicación reciente de un dispositivo registrado
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, latitud, longitud]
 *             properties:
 *               token:
 *                 type: string
 *               latitud:
 *                 type: number
 *               longitud:
 *                 type: number
 *               precision_ubicacion_m:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Ubicación actualizada
 *       404:
 *         description: Dispositivo no registrado para este usuario
 */
router.patch("/dispositivos/ubicacion", actualizarUbicacionDispositivo);

/**
 * @swagger
 * /notificaciones/dispositivos:
 *   delete:
 *     summary: Eliminar el token FCM del usuario autenticado
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispositivo eliminado
 */
router.delete("/dispositivos", eliminarDispositivo);

/**
 * @swagger
 * /notificaciones/preferencias:
 *   get:
 *     summary: Consultar preferencias de notificaciones push
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferencias por categoría
 */
router.get("/preferencias", obtenerPreferencias);

/**
 * @swagger
 * /notificaciones/preferencias:
 *   patch:
 *     summary: Actualizar preferencias de notificaciones push
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               avistamientos_cercanos:
 *                 type: boolean
 *               retos_por_vencer:
 *                 type: boolean
 *               actividad_avistamientos:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferencias actualizadas
 *       400:
 *         description: Se requiere al menos una preferencia booleana
 */
router.patch("/preferencias", actualizarPreferencias);

export default router;