import express from "express";
import { identificarEspecie, validarRegistroFaunaFlora } from "../controllers/ia.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

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
 */
router.post("/identificar", verificarToken, identificarEspecie);

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
 */
router.post("/validar-registro", verificarToken, validarRegistroFaunaFlora);

export default router;
