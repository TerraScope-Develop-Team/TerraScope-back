import express from "express";
const router =express.Router();

import {
  createAvistamiento,
  getAvistamientos,
  getAvistamientoById,
  deleteAvistamiento,
  addComentario
} from "../controllers/fauna_flora.controller.js";
// Autor: Leonel Torres
// Fecha: 2025-10-03
// Descripción: Rutas para manejar las operaciones CRUD de Habitad y Flora

//Crud de los avistamientos
router.post("/", createAvistamiento);
router.get("/",getAvistamientos);
router.get("/:id",getAvistamientoById);
router.delete("/:id",deleteAvistamiento);
//Creación de los comentarios
router.post("/:id/comentarios/",addComentario);

export default router;