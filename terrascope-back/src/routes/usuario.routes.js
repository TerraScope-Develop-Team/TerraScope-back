import { Router } from "express";
import {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  seleccionarTituloActivo, quitarTituloActivo
} from "../controllers/usuario.controller.js";

const router = Router();
router.patch("/titulo-activo", seleccionarTituloActivo);

// Quitar título activo
router.delete("/titulo-activo", quitarTituloActivo);
router.post("/", crearUsuario);
router.get("/", obtenerUsuarios);
router.get("/:id", obtenerUsuarioPorId);
router.patch("/:id", actualizarUsuario);
router.delete("/:id", eliminarUsuario);



export default router;