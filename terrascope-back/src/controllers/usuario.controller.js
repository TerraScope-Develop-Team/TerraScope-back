import Usuario from "../models/usuario.model.js";
import mongoose from "mongoose";

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
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    // Crear el nuevo usuario
    const nuevoUsuario = new Usuario({
      nombre_usuario,
      email_usuario,
      contrasenia_usuario,
      telefono_usuario,
      fecha_nac_usuario,
      rol,
      imagen_perfil: imagen_perfil || "" // Si no se envía imagen, se guarda vacío
    });

    await nuevoUsuario.save();
    res.status(201).json({
      message: "Usuario creado correctamente",
      data: nuevoUsuario
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
    const usuarios = await Usuario.find();
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener usuarios",
      error: error.message
    });
  }
};

// Obtener un usuario por ID (incluye conteo de seguidores y seguidos para el perfil)
export const obtenerUsuarioPorId = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    const usuario = await Usuario.findById(req.params.id)
      .populate("seguidores", "nombre_usuario imagen_perfil")
      .populate("seguidos", "nombre_usuario imagen_perfil");

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const usuarioObj = usuario.toObject();
    usuarioObj.total_seguidores = usuario.seguidores ? usuario.seguidores.length : 0;
    usuarioObj.total_seguidos = usuario.seguidos ? usuario.seguidos.length : 0;

    // Verificar si el usuario consultante ya lo sigue
    const currentUserId = req.usuario?._id || req.query.currentUserId || req.query.id_usuario;
    if (currentUserId && usuario.seguidores) {
      usuarioObj.is_following = usuario.seguidores.some(
        (seg) => (seg._id ? seg._id.toString() : seg.toString()) === currentUserId.toString()
      );
    } else {
      usuarioObj.is_following = false;
    }

    res.status(200).json(usuarioObj);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener usuario",
      error: error.message
    });
  }
};


// Actualizar un usuario
export const actualizarUsuario = async (req, res) => {
  try {
    const { imagen_perfil } = req.body;

    // Si se envía una imagen vacía, la ignoramos para no borrar la anterior
    const updateData = { ...req.body };
    if (imagen_perfil === undefined || imagen_perfil === null) {
      delete updateData.imagen_perfil;
    }

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!usuarioActualizado) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      message: "Usuario actualizado correctamente",
      data: usuarioActualizado
    });
  } catch (error) {
    res.status(400).json({
      message: "Error al actualizar usuario",
      error: error.message
    });
  }
};

// Eliminar un usuario
export const eliminarUsuario = async (req, res) => {
  try {
    const usuarioEliminado = await Usuario.findByIdAndDelete(req.params.id);
    if (!usuarioEliminado) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({
      message: "Error al eliminar usuario",
      error: error.message
    });
  }
};

export const seleccionarTituloActivo = async (req, res) => {
  console.log('🔥 CONTROLADOR EJECUTADO'); // 👈 PRIMERO ESTO
  console.log('📦 Body completo:', JSON.stringify(req.body)); 
  try {
    console.log('📦 Body recibido:', req.body);
    const { usuarioId, logroId } = req.body;
    console.log('Usuario ID:', usuarioId);
    console.log('Logro ID:', logroId);
   

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    // Buscar el logro en el array de logros del usuario
    const logro = usuario.logros.id(logroId);
    if (!logro) {
      return res.status(404).json({ mensaje: "Logro no encontrado" });
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
    console.error("Error al seleccionar título:", error);
    res.status(500).json({ mensaje: "Error del servidor" });
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
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

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
    const followerId = req.usuario?._id || req.body.id_usuario || req.body.seguidorId;

    if (!followerId) {
      return res.status(400).json({ message: "Se requiere id_usuario del seguidor" });
    }

    if (!mongoose.Types.ObjectId.isValid(targetId) || !mongoose.Types.ObjectId.isValid(followerId)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    if (targetId.toString() === followerId.toString()) {
      return res.status(400).json({ message: "No puedes seguirte a ti mismo" });
    }

    const [targetUser, followerUser] = await Promise.all([
      Usuario.findById(targetId),
      Usuario.findById(followerId)
    ]);

    if (!targetUser || !followerUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
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
    console.error("❌ Error al seguir usuario:", error);
    res.status(500).json({
      message: "Error al seguir usuario",
      error: error.message
    });
  }
};

// Dejar de seguir a un usuario
export const dejarDeSeguirUsuario = async (req, res) => {
  try {
    const targetId = req.params.id;
    const followerId = req.usuario?._id || req.body.id_usuario || req.body.seguidorId;

    if (!followerId) {
      return res.status(400).json({ message: "Se requiere id_usuario del seguidor" });
    }

    if (!mongoose.Types.ObjectId.isValid(targetId) || !mongoose.Types.ObjectId.isValid(followerId)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    const [targetUser, followerUser] = await Promise.all([
      Usuario.findById(targetId),
      Usuario.findById(followerId)
    ]);

    if (!targetUser || !followerUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
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
    console.error("❌ Error al dejar de seguir usuario:", error);
    res.status(500).json({
      message: "Error al dejar de seguir usuario",
      error: error.message
    });
  }
};

// Obtener lista de seguidores de un usuario
export const obtenerSeguidores = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    const usuario = await Usuario.findById(id).populate(
      "seguidores",
      "nombre_usuario email_usuario imagen_perfil rol"
    );

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      seguidores: usuario.seguidores || [],
      total: usuario.seguidores ? usuario.seguidores.length : 0
    });
  } catch (error) {
    console.error("❌ Error al obtener seguidores:", error);
    res.status(500).json({
      message: "Error al obtener seguidores",
      error: error.message
    });
  }
};

// Obtener lista de usuarios seguidos
export const obtenerSeguidos = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    const usuario = await Usuario.findById(id).populate(
      "seguidos",
      "nombre_usuario email_usuario imagen_perfil rol"
    );

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      seguidos: usuario.seguidos || [],
      total: usuario.seguidos ? usuario.seguidos.length : 0
    });
  } catch (error) {
    console.error("❌ Error al obtener seguidos:", error);
    res.status(500).json({
      message: "Error al obtener seguidos",
      error: error.message
    });
  }
};