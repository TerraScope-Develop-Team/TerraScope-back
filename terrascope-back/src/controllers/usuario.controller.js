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
      imagen_perfil // 🖼️ Nuevo campo
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
        nombre_rol: "Usuario"
      },
      imagen_perfil: imagen_perfil || "" // Si no se envía imagen, se guarda vacío
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

// Obtener un usuario por ID
export const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select("-contrasenia_usuario");
    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }
    res.status(200).json(usuario);
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener usuario");
  }
};

// Actualizar un usuario
export const actualizarUsuario = async (req, res) => {
  try {
    const { imagen_perfil } = req.body;

    // Si se envía una imagen vacía, la ignoramos para no borrar la anterior
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

    // Buscar el logro en el array de logros del usuario
    const logro = usuario.logros.id(logroId);
    if (!logro) {
      return respondWithError(res, 404, "ACHIEVEMENT_NOT_FOUND", "Logro no encontrado");
    }

    // Actualizar título activo
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