import { Router } from "express";
import {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  seleccionarTituloActivo,
  quitarTituloActivo,
  seguirUsuario,
  dejarDeSeguirUsuario,
  obtenerSeguidores,
  obtenerSeguidos
} from "../controllers/usuario.controller.js";
import {
  authenticate,
  requireBodyUserOrAdmin,
  requireRoles,
  requireSelfOrAdmin
} from "../middleware/auth.middleware.js";

const router = Router();

router.patch("/titulo-activo", authenticate, requireBodyUserOrAdmin(), seleccionarTituloActivo);
router.delete("/titulo-activo", authenticate, requireBodyUserOrAdmin(), quitarTituloActivo);

router.post("/", crearUsuario);
router.get("/", authenticate, requireRoles("Administrador"), obtenerUsuarios);

// Rutas sociales de seguidores y seguidos (antes de /:id para evitar colisiones)
router.get("/:id/seguidores", authenticate, obtenerSeguidores);
router.get("/:id/seguidos", authenticate, obtenerSeguidos);
router.post("/:id/seguir", authenticate, seguirUsuario);
router.post("/:id/follow", authenticate, seguirUsuario); // Alias
router.post("/:id/dejar-seguir", authenticate, dejarDeSeguirUsuario);
router.post("/:id/unfollow", authenticate, dejarDeSeguirUsuario); // Alias

// Perfil y CRUD de usuario
router.get("/:id", authenticate, obtenerUsuarioPorId);
router.patch("/:id", authenticate, requireSelfOrAdmin, actualizarUsuario);
router.delete("/:id", authenticate, requireRoles("Administrador"), eliminarUsuario);

export default router;
