import Usuario from "../models/usuario.model.js";

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

// Obtener un usuario por ID
export const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.status(200).json(usuario);
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