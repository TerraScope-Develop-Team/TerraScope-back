import express from "express";
import {
  createHabitat,
  getAllHabitats,
  getHabitatById,
  updateHabitat,
  deleteHabitat
} from "../controllers/habitat.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.middleware.js";

// Autor: César González
// Fecha: 2025-10-03
// Descripción: Rutas para manejar las operaciones CRUD de hábitats

const router = express.Router();

// Crear un nuevo hábitat
router.post("/", authenticate, requireRoles("Administrador"), createHabitat);

// Obtener todos los hábitats
router.get("/", getAllHabitats);

// Obtener un hábitat por ID
router.get("/:id", getHabitatById);

// Actualizar un hábitat
router.put("/:id", authenticate, requireRoles("Administrador"), updateHabitat);

// Eliminar un hábitat
router.delete("/:id", authenticate, requireRoles("Administrador"), deleteHabitat);

export default router;
