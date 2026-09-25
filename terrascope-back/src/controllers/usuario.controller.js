import prisma from "../config/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

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
        createdAt: true,
        updatedAt: true
      }
    });
    
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