import { Router } from "express";
import {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  seleccionarTituloActivo, 
  quitarTituloActivo,
  loginUsuario
} from "../controllers/usuario.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /usuarios/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Usuarios]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_usuario:
 *                 type: string
 *               contrasenia_usuario:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso. Devuelve los datos del usuario y el token JWT.
 *       401:
 *         description: Credenciales inválidas.
 */
router.post("/login", loginUsuario);
/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Crear un nuevo usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre_usuario
 *               - email_usuario
 *               - contrasenia_usuario
 *               - rol
 *             properties:
 *               nombre_usuario:
 *                 type: string
 *               email_usuario:
 *                 type: string
 *               contrasenia_usuario:
 *                 type: string
 *               rol:
 *                 type: string
 *                 enum: [Usuario, Investigador, Experto, Administrador]
 *     responses:
 *       201:
 *         description: Usuario creado
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 */
router.post("/", crearUsuario);
router.get("/", verificarToken, obtenerUsuarios);

/**
 * @swagger
 * /usuarios/titulo-activo:
 *   patch:
 *     summary: Seleccionar título activo
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Título seleccionado
 *   delete:
 *     summary: Quitar título activo
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Título quitado
 */
router.patch("/titulo-activo", verificarToken, seleccionarTituloActivo);
router.delete("/titulo-activo", verificarToken, quitarTituloActivo);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *   patch:
 *     summary: Actualizar usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *   delete:
 *     summary: Eliminar usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Usuario eliminado
 */
router.get("/:id", verificarToken, obtenerUsuarioPorId);
router.patch("/:id", verificarToken, actualizarUsuario);
router.delete("/:id", verificarToken, eliminarUsuario);
export default router;