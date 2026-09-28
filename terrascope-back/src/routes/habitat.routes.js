import express from "express";
import {
  createHabitat,
  getAllHabitats,
  getHabitatById,
  updateHabitat,
  deleteHabitat
} from "../controllers/habitat.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

// Autor: César González
// Fecha: 2025-10-03
// Descripción: Rutas para manejar las operaciones CRUD de hábitats

const router = express.Router();

/**
 * @swagger
 * /habitats:
 *   post:
 *     summary: Crear un nuevo hábitat
 *     tags: [Hábitats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Hábitat creado
 *   get:
 *     summary: Obtener todos los hábitats
 *     tags: [Hábitats]
 *     responses:
 *       200:
 *         description: Lista de hábitats
 */
router.post("/", verificarToken, createHabitat);
router.get("/", getAllHabitats);

/**
 * @swagger
 * /habitats/{id}:
 *   get:
 *     summary: Obtener hábitat por ID
 *     tags: [Hábitats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hábitat encontrado
 *   put:
 *     summary: Actualizar hábitat
 *     tags: [Hábitats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hábitat actualizado
 *   delete:
 *     summary: Eliminar hábitat
 *     tags: [Hábitats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hábitat eliminado
 */
router.get("/:id", getHabitatById);
router.put("/:id", verificarToken, updateHabitat);
router.delete("/:id", verificarToken, deleteHabitat);

export default router;
