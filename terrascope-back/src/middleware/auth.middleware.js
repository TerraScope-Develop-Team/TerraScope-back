import jwt from "jsonwebtoken";
import Usuario from "../models/usuario.model.js";
import { respondWithError } from "../utils/controller-error.js";

export const authenticate = async (req, res, next) => {
  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return respondWithError(res, 401, "AUTHENTICATION_REQUIRED", "Autenticación requerida");
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });
  } catch {
    return respondWithError(res, 401, "INVALID_OR_EXPIRED_TOKEN", "Token no válido o expirado");
  }

  if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
    return respondWithError(res, 401, "INVALID_TOKEN", "Token no válido");
  }

  try {
    const usuario = await Usuario.findById(payload.sub);
    if (!usuario) {
      return respondWithError(res, 401, "INVALID_TOKEN", "Token no válido");
    }

    req.user = usuario;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return respondWithError(res, 401, "AUTHENTICATION_REQUIRED", "Autenticación requerida");
  }

  if (!roles.includes(req.user.rol?.nombre_rol)) {
    return respondWithError(res, 403, "FORBIDDEN", "No tienes permisos para esta operación");
  }

  next();
};

export const requireSelfOrAdmin = (req, res, next) => {
  const isAdmin = req.user.rol?.nombre_rol === "Administrador";
  if (isAdmin || req.params.id === req.user._id.toString()) {
    return next();
  }

  return respondWithError(res, 403, "USER_ACCESS_FORBIDDEN", "No tienes permisos para este usuario");
};

export const requireParamUserOrAdmin = (field = "usuarioId") => (req, res, next) => {
  const isAdmin = req.user.rol?.nombre_rol === "Administrador";
  if (isAdmin || req.params[field] === req.user._id.toString()) {
    return next();
  }

  return respondWithError(res, 403, "USER_ACCESS_FORBIDDEN", "No tienes permisos para este usuario");
};

export const requireBodyUserOrAdmin = (field = "usuarioId") => (req, res, next) => {
  const isAdmin = req.user.rol?.nombre_rol === "Administrador";
  if (isAdmin || req.body[field] === req.user._id.toString()) {
    return next();
  }

  return respondWithError(res, 403, "USER_ACCESS_FORBIDDEN", "No tienes permisos para este usuario");
};