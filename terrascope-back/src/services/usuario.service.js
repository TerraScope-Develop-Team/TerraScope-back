import jwt from 'jsonwebtoken';

export const generarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'secreto_por_defecto', {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });

export const normalizeLoginPayload = ({ email_usuario, contrasenia_usuario }) => {
  if (!email_usuario || !contrasenia_usuario) {
    return null;
  }

  return {
    email_usuario,
    contrasenia_usuario,
  };
};

export const serializeUsuario = (usuario = {}) => {
  const { contrasenia_usuario: _, ...rest } = usuario;
  return rest;
};

export const buildUserProfileResponse = (usuario, currentUserId) => {
  const seguidores = Array.isArray(usuario?.seguidores) ? usuario.seguidores : [];
  const seguidos = Array.isArray(usuario?.seguidos) ? usuario.seguidos : [];
  const normalizedCurrentUserId = currentUserId ? String(currentUserId) : null;

  return {
    ...usuario,
    total_seguidores: seguidores.length,
    total_seguidos: seguidos.length,
    is_following: Boolean(normalizedCurrentUserId && seguidores.includes(normalizedCurrentUserId)),
  };
};

export const buildUserUpdateData = (body = {}, hashedPassword) => {
  const { imagen_perfil, contrasenia_usuario, ...otrosDatos } = body;
  const updateData = { ...otrosDatos };

  if (imagen_perfil !== undefined && imagen_perfil !== null) {
    updateData.imagen_perfil = imagen_perfil;
  }

  if (contrasenia_usuario && hashedPassword) {
    updateData.contrasenia_usuario = hashedPassword;
  }

  return updateData;
};
