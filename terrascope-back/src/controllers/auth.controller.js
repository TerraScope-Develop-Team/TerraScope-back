import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Usuario from "../models/usuario.model.js";
import { respondWithControllerError, respondWithError } from "../utils/controller-error.js";

export const iniciarSesion = async (req, res) => {
  const { email_usuario, contrasenia_usuario } = req.body;

    if (!email_usuario || !contrasenia_usuario) {
      return respondWithError(res, 400, "LOGIN_FIELDS_REQUIRED", "Correo y contraseña son requeridos");
  }

  try {
    const usuario = await Usuario.findOne({ email_usuario: email_usuario.toLowerCase() })
      .select("+contrasenia_usuario");

      if (!usuario || !(await bcrypt.compare(contrasenia_usuario, usuario.contrasenia_usuario))) {
        return respondWithError(res, 401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos");
    }

    const token = jwt.sign(
      { sub: usuario._id.toString(), role: usuario.rol.nombre_rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h", algorithm: "HS256" }
    );

    res.status(200).json({
      token,
      usuario: {
        id: usuario._id,
        nombre_usuario: usuario.nombre_usuario,
        email_usuario: usuario.email_usuario,
        rol: usuario.rol
      }
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al iniciar sesión");
  }
};