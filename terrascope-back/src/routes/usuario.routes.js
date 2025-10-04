import { Router } from "express";
import {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario
} from "../controllers/usuario.controller.js";

const router = Router();

router.post("/", crearUsuario);
router.get("/", obtenerUsuarios);
router.get("/:id", obtenerUsuarioPorId);
router.patch("/:id", actualizarUsuario);
router.delete("/:id", eliminarUsuario);

export default router;