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

const router = Router();

router.patch("/titulo-activo", seleccionarTituloActivo);
router.delete("/titulo-activo", quitarTituloActivo);

router.post("/", crearUsuario);
router.get("/", obtenerUsuarios);

// Rutas de seguidores y seguidos (antes de /:id para evitar colisiones)
router.get("/:id/seguidores", obtenerSeguidores);
router.get("/:id/seguidos", obtenerSeguidos);
router.post("/:id/seguir", seguirUsuario);
router.post("/:id/follow", seguirUsuario); // Alias
router.post("/:id/dejar-seguir", dejarDeSeguirUsuario);
router.post("/:id/unfollow", dejarDeSeguirUsuario); // Alias

// CRUD de usuario
router.get("/:id", obtenerUsuarioPorId);
router.patch("/:id", actualizarUsuario);
router.delete("/:id", eliminarUsuario);

export default router;