import mongoose from "mongoose";
import Usuario from "../models/usuario.model.js";
import { respondWithControllerError, respondWithError } from "../utils/controller-error.js";

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
      return respondWithError(res, 400, "USER_FIELDS_REQUIRED", "Faltan campos obligatorios");
    }

    // Crear el nuevo usuario
    const nuevoUsuario = new Usuario({
      nombre_usuario,
      email_usuario,
      contrasenia_usuario,
      telefono_usuario,
      fecha_nac_usuario,
      rol: {
        id_rol: rol.id_rol,
        nombre_rol: rol.nombre_rol || "Usuario"
      },
      imagen_perfil: imagen_perfil || ""
    });

    await nuevoUsuario.save();
    res.status(201).json({
      message: "Usuario creado correctamente",
      data: nuevoUsuario
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al crear usuario");
  }
};

// Obtener todos los usuarios
export const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find().select("-contrasenia_usuario");
    res.status(200).json(usuarios);
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener usuarios");
  }
};

// Obtener un usuario por ID (incluye conteo de seguidores y seguidos para el perfil)
export const obtenerUsuarioPorId = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return respondWithError(res, 400, "INVALID_USER_ID", "ID de usuario inválido");
    }

    const usuario = await Usuario.findById(req.params.id)
      .select("-contrasenia_usuario")
      .populate("seguidores", "nombre_usuario imagen_perfil")
      .populate("seguidos", "nombre_usuario imagen_perfil");

    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    const usuarioObj = usuario.toObject();
    usuarioObj.total_seguidores = usuario.seguidores ? usuario.seguidores.length : 0;
    usuarioObj.total_seguidos = usuario.seguidos ? usuario.seguidos.length : 0;

    // Verificar si el usuario autenticado ya sigue a este perfil
    const currentUserId = req.user?._id?.toString() || req.query.currentUserId || req.query.id_usuario;
    if (currentUserId && usuario.seguidores) {
      usuarioObj.is_following = usuario.seguidores.some(
        (seg) => (seg._id ? seg._id.toString() : seg.toString()) === currentUserId.toString()
      );
    } else {
      usuarioObj.is_following = false;
    }

    res.status(200).json(usuarioObj);
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener usuario");
  }
};

// Actualizar un usuario
export const actualizarUsuario = async (req, res) => {
  try {
    const { imagen_perfil } = req.body;

    const allowedFields = [
      "nombre_usuario",
      "telefono_usuario",
      "fecha_nac_usuario",
      "imagen_perfil"
    ];
    const updateData = Object.fromEntries(
      allowedFields
        .filter((field) => Object.hasOwn(req.body, field))
        .map((field) => [field, req.body[field]])
    );
    if (imagen_perfil === undefined || imagen_perfil === null) {
      delete updateData.imagen_perfil;
    }

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!usuarioActualizado) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    res.status(200).json({
      message: "Usuario actualizado correctamente",
      data: usuarioActualizado
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al actualizar usuario");
  }
};

// Eliminar un usuario
export const eliminarUsuario = async (req, res) => {
  try {
    const usuarioEliminado = await Usuario.findByIdAndDelete(req.params.id);
    if (!usuarioEliminado) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }
    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al eliminar usuario");
  }
};

export const seleccionarTituloActivo = async (req, res) => {
  try {
    const { usuarioId, logroId } = req.body;

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    const logro = usuario.logros.id(logroId);
    if (!logro) {
      return respondWithError(res, 404, "ACHIEVEMENT_NOT_FOUND", "Logro no encontrado");
    }

    usuario.titulo_activo = {
      id_logro: logro._id.toString(),
      nombre_logro: logro.nombre_logro,
      descripcion_titulo: logro.descripcion_titulo
    };

    await usuario.save();

    res.status(200).json({
      mensaje: "Título actualizado correctamente",
      titulo_activo: usuario.titulo_activo
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al seleccionar título");
  }
};

// Quitar título activo
export const quitarTituloActivo = async (req, res) => {
  try {
    const { usuarioId } = req.body;

    const usuario = await Usuario.findByIdAndUpdate(
      usuarioId,
      { $unset: { titulo_activo: "" } },
      { new: true }
    );

    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    res.status(200).json({ mensaje: "Título removido correctamente" });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al quitar título");
  }
};

// Seguir a un usuario
export const seguirUsuario = async (req, res) => {
  try {
    const targetId = req.params.id;
    const followerId = req.user?._id?.toString() || req.body.id_usuario || req.body.seguidorId;

    if (!followerId) {
      return respondWithError(res, 400, "FOLLOWER_ID_REQUIRED", "Se requiere identificación del seguidor");
    }

    if (!mongoose.Types.ObjectId.isValid(targetId) || !mongoose.Types.ObjectId.isValid(followerId)) {
      return respondWithError(res, 400, "INVALID_USER_ID", "ID de usuario inválido");
    }

    if (targetId.toString() === followerId.toString()) {
      return respondWithError(res, 400, "CANNOT_FOLLOW_SELF", "No puedes seguirte a ti mismo");
    }

    const [targetUser, followerUser] = await Promise.all([
      Usuario.findById(targetId),
      Usuario.findById(followerId)
    ]);

    if (!targetUser || !followerUser) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    // Agregar de forma atómica evitando duplicados
    await Promise.all([
      Usuario.findByIdAndUpdate(followerId, { $addToSet: { seguidos: targetId } }),
      Usuario.findByIdAndUpdate(targetId, { $addToSet: { seguidores: followerId } })
    ]);

    const updatedTarget = await Usuario.findById(targetId);
    const updatedFollower = await Usuario.findById(followerId);

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
    const followerId = req.user?._id?.toString() || req.body.id_usuario || req.body.seguidorId;

    if (!followerId) {
      return respondWithError(res, 400, "FOLLOWER_ID_REQUIRED", "Se requiere identificación del seguidor");
    }

    if (!mongoose.Types.ObjectId.isValid(targetId) || !mongoose.Types.ObjectId.isValid(followerId)) {
      return respondWithError(res, 400, "INVALID_USER_ID", "ID de usuario inválido");
    }

    const [targetUser, followerUser] = await Promise.all([
      Usuario.findById(targetId),
      Usuario.findById(followerId)
    ]);

    if (!targetUser || !followerUser) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    // Remover de forma atómica
    await Promise.all([
      Usuario.findByIdAndUpdate(followerId, { $pull: { seguidos: targetId } }),
      Usuario.findByIdAndUpdate(targetId, { $pull: { seguidores: followerId } })
    ]);

    const updatedTarget = await Usuario.findById(targetId);
    const updatedFollower = await Usuario.findById(followerId);

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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respondWithError(res, 400, "INVALID_USER_ID", "ID de usuario inválido");
    }

    const usuario = await Usuario.findById(id).populate(
      "seguidores",
      "nombre_usuario email_usuario imagen_perfil rol"
    );

    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    res.status(200).json({
      seguidores: usuario.seguidores || [],
      total: usuario.seguidores ? usuario.seguidores.length : 0
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener seguidores");
  }
};

// Obtener lista de usuarios seguidos
export const obtenerSeguidos = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respondWithError(res, 400, "INVALID_USER_ID", "ID de usuario inválido");
    }

    const usuario = await Usuario.findById(id).populate(
      "seguidos",
      "nombre_usuario email_usuario imagen_perfil rol"
    );

    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    res.status(200).json({
      seguidos: usuario.seguidos || [],
      total: usuario.seguidos ? usuario.seguidos.length : 0
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener seguidos");
  }
};
