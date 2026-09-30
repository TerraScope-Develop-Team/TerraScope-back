import prisma from "../config/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { respondWithError, respondWithControllerError } from "../utils/controller-error.js";

const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secreto_por_defecto", {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  });
};

export const loginUsuario = async (req, res) => {
  try {
    const { email_usuario, contrasenia_usuario } = req.body;

    if (!email_usuario || !contrasenia_usuario) {
      return res.status(400).json({ message: "Por favor provea email y contraseña" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email_usuario }
    });

    if (usuario && (await bcrypt.compare(contrasenia_usuario, usuario.contrasenia_usuario))) {
      res.json({
        _id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        email_usuario: usuario.email_usuario,
        rol: usuario.rol,
        token: generarToken(usuario.id),
      });
    } else {
      res.status(401).json({ message: "Email o contraseña incorrectos" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error en el servidor", error: error.message });
  }
};

// Crear un usuario
export const crearUsuario = async (req, res) => {
  try {
    const {
      nombre_usuario,
      email_usuario,
      contrasenia_usuario,
      telefono_usuario,
      fecha_nac_usuario,
      rol,
      imagen_perfil
    } = req.body;

    // Validar campos requeridos
    if (!nombre_usuario || !email_usuario || !contrasenia_usuario || !rol) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    // Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(contrasenia_usuario, salt);

    // Crear el nuevo usuario
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre_usuario,
        email_usuario,
        contrasenia_usuario: hashedPassword,
        telefono_usuario,
        fecha_nac_usuario: fecha_nac_usuario ? new Date(fecha_nac_usuario) : null,
        rol,
        imagen_perfil: imagen_perfil || ""
      }
    });

    // Remover contraseña de la respuesta
    const { contrasenia_usuario: _, ...usuarioResponse } = nuevoUsuario;

    res.status(201).json({
      message: "Usuario creado correctamente",
      data: usuarioResponse
    });
  } catch (error) {
    res.status(400).json({
      message: "Error al crear usuario",
      error: error.message
    });
  }
};

// Obtener todos los usuarios
export const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre_usuario: true,
        email_usuario: true,
        telefono_usuario: true,
        fecha_nac_usuario: true,
        imagen_perfil: true,
        rol: true,
        logros: true,
        titulo_activo: true,
        historial: true,
        retos_activos: true,
        createdAt: true,
        updatedAt: true
      }
    });
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener usuarios",
      error: error.message
    });
  }
};

// Obtener un usuario por ID
export const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        nombre_usuario: true,
        email_usuario: true,
        telefono_usuario: true,
        fecha_nac_usuario: true,
        imagen_perfil: true,
        rol: true,
        logros: true,
        titulo_activo: true,
        historial: true,
        retos_activos: true,
        seguidores: true,
        seguidos: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    const currentUserId = req.usuario?.id?.toString() || req.user?.id?.toString() || req.query.currentUserId || req.query.id_usuario;
    const is_following = currentUserId && usuario.seguidores
      ? usuario.seguidores.includes(currentUserId.toString())
      : false;

    res.status(200).json({
      ...usuario,
      total_seguidores: usuario.seguidores ? usuario.seguidores.length : 0,
      total_seguidos: usuario.seguidos ? usuario.seguidos.length : 0,
      is_following
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener usuario");
  }
};

// Actualizar un usuario
export const actualizarUsuario = async (req, res) => {
  try {
    const { imagen_perfil, contrasenia_usuario, ...otrosDatos } = req.body;

    const updateData = { ...otrosDatos };

    if (imagen_perfil !== undefined && imagen_perfil !== null) {
      updateData.imagen_perfil = imagen_perfil;
    }

    if (contrasenia_usuario) {
      const salt = await bcrypt.genSalt(10);
      updateData.contrasenia_usuario = await bcrypt.hash(contrasenia_usuario, salt);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        nombre_usuario: true,
        email_usuario: true,
        rol: true
      }
    });

    res.status(200).json({
      message: "Usuario actualizado correctamente",
      data: usuarioActualizado
    });
  } catch (error) {
    res.status(400).json({
      message: "Error al actualizar usuario (quizás no existe)",
      error: error.message
    });
  }
};

// Eliminar un usuario
export const eliminarUsuario = async (req, res) => {
  try {
    await prisma.usuario.delete({
      where: { id: req.params.id }
    });
    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({
      message: "Error al eliminar usuario",
      error: error.message
    });
  }
};

// Seleccionar titulo activo
export const seleccionarTituloActivo = async (req, res) => {
  try {
    const { usuarioId, logroId } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId }
    });

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    // Buscar el logro en el array de logros del usuario
    const logro = usuario.logros?.find(l => l.id === logroId);
    if (!logro) {
      return res.status(404).json({ mensaje: "Logro no encontrado" });
    }

    // Actualizar título activo
    const usuarioActualizado = await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        titulo_activo: {
          id_logro: logro.id,
          nombre_logro: logro.nombre_logro,
          descripcion_titulo: logro.descripcion_titulo
        }
      }
    });

    res.status(200).json({
      mensaje: "Título actualizado correctamente",
      titulo_activo: usuarioActualizado.titulo_activo
    });
  } catch (error) {
    console.error("Error al seleccionar título:", error);
    res.status(500).json({ mensaje: "Error del servidor" });
  }
};

// Quitar título activo
export const quitarTituloActivo = async (req, res) => {
  try {
    const { usuarioId } = req.body;

    const usuario = await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        titulo_activo: { unset: true } // MongoDB Prisma forma de quitar un embedded document
      }
    });

    res.status(200).json({ mensaje: "Título removido correctamente" });
  } catch (error) {
    console.error("Error al quitar título:", error);
    res.status(500).json({ mensaje: "Error del servidor" });
  }
};

// Seguir a un usuario
export const seguirUsuario = async (req, res) => {
  try {
    const targetId = req.params.id;
    const followerId = req.usuario?.id?.toString() || req.user?.id?.toString() || req.body.id_usuario || req.body.seguidorId;

    if (!followerId) {
      return respondWithError(res, 400, "FOLLOWER_ID_REQUIRED", "Se requiere identificación del seguidor");
    }

    if (targetId.toString() === followerId.toString()) {
      return respondWithError(res, 400, "CANNOT_FOLLOW_SELF", "No puedes seguirte a ti mismo");
    }

    const targetUser = await prisma.usuario.findUnique({ where: { id: targetId }, select: { id: true, nombre_usuario: true, seguidores: true } });
    const followerUser = await prisma.usuario.findUnique({ where: { id: followerId }, select: { id: true, seguidos: true } });

    if (!targetUser || !followerUser) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    if (!followerUser.seguidos.includes(targetId)) {
      await prisma.usuario.update({
        where: { id: followerId },
        data: { seguidos: { push: targetId } }
      });
    }

    if (!targetUser.seguidores.includes(followerId)) {
      await prisma.usuario.update({
        where: { id: targetId },
        data: { seguidores: { push: followerId } }
      });
    }

    const updatedTarget = await prisma.usuario.findUnique({ where: { id: targetId }, select: { seguidores: true } });
    const updatedFollower = await prisma.usuario.findUnique({ where: { id: followerId }, select: { seguidos: true } });

    res.status(200).json({
      message: `Ahora sigues a ${targetUser.nombre_usuario}`,
      following: true,
      total_seguidores: updatedTarget.seguidores ? updatedTarget.seguidores.length : 0,
      total_seguidos: updatedFollower.seguidos ? updatedFollower.seguidos.length : 0
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al seguir usuario");
  }
};

// Dejar de seguir a un usuario
export const dejarDeSeguirUsuario = async (req, res) => {
  try {
    const targetId = req.params.id;
    const followerId = req.usuario?.id?.toString() || req.user?.id?.toString() || req.body.id_usuario || req.body.seguidorId;

    if (!followerId) {
      return respondWithError(res, 400, "FOLLOWER_ID_REQUIRED", "Se requiere identificación del seguidor");
    }

    const targetUser = await prisma.usuario.findUnique({ where: { id: targetId }, select: { id: true, nombre_usuario: true, seguidores: true } });
    const followerUser = await prisma.usuario.findUnique({ where: { id: followerId }, select: { id: true, seguidos: true } });

    if (!targetUser || !followerUser) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    // Filtrar para remover
    await prisma.usuario.update({
      where: { id: followerId },
      data: { seguidos: followerUser.seguidos.filter(id => id !== targetId) }
    });

    await prisma.usuario.update({
      where: { id: targetId },
      data: { seguidores: targetUser.seguidores.filter(id => id !== followerId) }
    });

    const updatedTarget = await prisma.usuario.findUnique({ where: { id: targetId }, select: { seguidores: true } });
    const updatedFollower = await prisma.usuario.findUnique({ where: { id: followerId }, select: { seguidos: true } });

    res.status(200).json({
      message: `Has dejado de seguir a ${targetUser.nombre_usuario}`,
      following: false,
      total_seguidores: updatedTarget.seguidores ? updatedTarget.seguidores.length : 0,
      total_seguidos: updatedFollower.seguidos ? updatedFollower.seguidos.length : 0
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al dejar de seguir usuario");
  }
};

// Obtener lista de seguidores de un usuario
export const obtenerSeguidores = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { seguidores: true }
    });

    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    const seguidoresDetalle = await prisma.usuario.findMany({
      where: { id: { in: usuario.seguidores } },
      select: { id: true, nombre_usuario: true, email_usuario: true, imagen_perfil: true, rol: true }
    });

    res.status(200).json({
      seguidores: seguidoresDetalle,
      total: seguidoresDetalle.length
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener seguidores");
  }
};

// Obtener lista de usuarios seguidos
export const obtenerSeguidos = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { seguidos: true }
    });

    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    const seguidosDetalle = await prisma.usuario.findMany({
      where: { id: { in: usuario.seguidos } },
      select: { id: true, nombre_usuario: true, email_usuario: true, imagen_perfil: true, rol: true }
    });

    res.status(200).json({
      seguidos: seguidosDetalle,
      total: seguidosDetalle.length
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener seguidos");
  }
};