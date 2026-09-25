import { Router } from "express";
import {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  seleccionarTituloActivo, quitarTituloActivo
} from "../controllers/usuario.controller.js";
import {
  authenticate,
  requireBodyUserOrAdmin,
  requireRoles,
  requireSelfOrAdmin
} from "../middleware/auth.middleware.js";

const router = Router();
router.patch("/titulo-activo", authenticate, requireBodyUserOrAdmin(), seleccionarTituloActivo);

// Quitar título activo
router.delete("/titulo-activo", authenticate, requireBodyUserOrAdmin(), quitarTituloActivo);
router.post("/", crearUsuario);
router.get("/", authenticate, requireRoles("Administrador"), obtenerUsuarios);
router.get("/:id", authenticate, requireSelfOrAdmin, obtenerUsuarioPorId);
router.patch("/:id", authenticate, requireSelfOrAdmin, actualizarUsuario);
router.delete("/:id", authenticate, requireRoles("Administrador"), eliminarUsuario);



export default router;