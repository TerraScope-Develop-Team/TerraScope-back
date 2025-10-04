import express from "express";
import {
  createHabitat,
  getAllHabitats,
  getHabitatById,
  updateHabitat,
  deleteHabitat
} from "../controllers/habitat.controller.js";

// Autor: César González
// Fecha: 2025-10-03
// Descripción: Rutas para manejar las operaciones CRUD de hábitats

const router = express.Router();

// Crear un nuevo hábitat
router.post("/", createHabitat);

// Obtener todos los hábitats
router.get("/", getAllHabitats);

// Obtener un hábitat por ID
router.get("/:id", getHabitatById);

// Actualizar un hábitat
router.put("/:id", updateHabitat);

// Eliminar un hábitat
router.delete("/:id", deleteHabitat);

export default router;
