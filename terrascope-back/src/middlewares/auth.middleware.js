import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

export const verificarToken = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Decodificar el token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_por_defecto");

      // Buscar el usuario por ID y excluir la contraseña de la respuesta
      const usuarioEncontrado = await prisma.usuario.findUnique({
        where: { id: decoded.id }
      });

      if (!usuarioEncontrado) {
        return res.status(401).json({ message: "Usuario no encontrado, token inválido" });
      }

      // Eliminar la contraseña del objeto
      const { contrasenia_usuario, ...usuarioSinPass } = usuarioEncontrado;
      req.usuario = usuarioSinPass;
      req.user = usuarioSinPass;

      next();
    } catch (error) {
      console.error(error);
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "El token ha expirado. Por favor, inicie sesión nuevamente." });
      }
      return res.status(401).json({ message: "No autorizado, token fallido o inválido" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "No autorizado, no hay token provisto" });
  }
};
