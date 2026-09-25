import mongoose from "mongoose";
import Usuario from "../models/usuario.model.js";

/**
 * Middleware para identificar y autenticar al usuario solicitante.
 * Soporta headers ('x-user-id', 'authorization'), body o query params.
 */
export const autenticarUsuario = async (req, res, next) => {
  try {
    const userId =
      req.headers["x-user-id"] ||
      req.headers["authorization"]?.replace("Bearer ", "") ||
      req.body?.id_usuario ||
      req.body?.usuarioId ||
      req.query?.id_usuario ||
      req.query?.usuarioId;

    if (!userId) {
      return res.status(401).json({
        message: "No autorizado: se requiere identificación de usuario (header x-user-id o parámetro id_usuario)"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario autenticado no encontrado" });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    console.error("❌ Error en middleware de autenticación:", error);
    res.status(500).json({ message: "Error interno en autenticación", error: error.message });
  }
};

/**
 * Middleware para verificar rol de Administrador (RNF03).
 */
export const verificarAdmin = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  const rol = req.usuario.rol?.nombre_rol;
  if (rol !== "Administrador") {
    return res.status(403).json({
      message: "Acceso denegado: se requieren permisos de Administrador para esta acción"
    });
  }

  next();
};
