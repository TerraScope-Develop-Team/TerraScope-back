import prisma from '../config/db.js';

export const preferenceFields = [
  'avistamientos_cercanos',
  'retos_por_vencer',
  'actividad_avistamientos',
];

export const getAuthenticatedUserId = (req) => req.usuario?.id || req.user?.id;

export const getRequestBody = (req) =>
  req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};

export const normalizeToken = (token) => {
  if (typeof token !== 'string') return null;
  const normalizedToken = token.trim();
  if (
    normalizedToken.length < 8 ||
    normalizedToken.length > 4096 ||
    /\s/.test(normalizedToken)
  ) {
    return null;
  }
  return normalizedToken;
};

export const validateCoordinates = ({ latitud, longitud, precision_ubicacion_m }) => {
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) return false;
  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) return false;
  return (
    precision_ubicacion_m === undefined ||
    precision_ubicacion_m === null ||
    (Number.isFinite(precision_ubicacion_m) && precision_ubicacion_m >= 0)
  );
};

export const buildPreferenceUpdate = (body = {}) => {
  const data = {};

  for (const field of preferenceFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'boolean') {
        throw new Error(`${field} debe ser booleano`);
      }
      data[field] = body[field];
    }
  }

  return data;
};

export async function registrarDispositivoService({ usuarioId, token, plataforma, latitud, longitud, precision_ubicacion_m }) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    const error = new Error('Se requiere un token FCM válido');
    error.statusCode = 400;
    throw error;
  }

  if (
    plataforma !== undefined &&
    plataforma !== null &&
    (typeof plataforma !== 'string' || plataforma.trim().length === 0 || plataforma.length > 32)
  ) {
    const error = new Error('La plataforma debe ser una cadena de hasta 32 caracteres');
    error.statusCode = 400;
    throw error;
  }

  const hasLatitude = latitud !== undefined;
  const hasLongitude = longitud !== undefined;
  if (
    hasLatitude !== hasLongitude ||
    (hasLatitude && !validateCoordinates({ latitud, longitud, precision_ubicacion_m }))
  ) {
    const error = new Error('Las coordenadas o su precisión no son válidas');
    error.statusCode = 400;
    throw error;
  }

  const locationData = hasLatitude
    ? {
        latitud,
        longitud,
        precision_ubicacion_m: precision_ubicacion_m ?? null,
        ubicacion_actualizada: new Date(),
      }
    : {};

  const existingDevice = await prisma.dispositivoPush.findUnique({
    where: { token: normalizedToken },
    select: { usuario_id: true },
  });
  const deviceWasReassigned = existingDevice && existingDevice.usuario_id !== usuarioId;

  return prisma.dispositivoPush.upsert({
    where: { token: normalizedToken },
    create: {
      token: normalizedToken,
      plataforma: plataforma?.trim() || null,
      usuario_id: usuarioId,
      latitud: hasLatitude ? latitud : null,
      longitud: hasLongitude ? longitud : null,
      precision_ubicacion_m: precision_ubicacion_m ?? null,
      ubicacion_actualizada: hasLatitude ? new Date() : null,
    },
    update: {
      usuario_id: usuarioId,
      ...(plataforma !== undefined ? { plataforma: plataforma?.trim() || null } : {}),
      ...(deviceWasReassigned && !hasLatitude
        ? {
            latitud: null,
            longitud: null,
            precision_ubicacion_m: null,
            ubicacion_actualizada: null,
          }
        : {}),
      ...locationData,
    },
    select: { id: true, plataforma: true },
  });
}

export async function actualizarUbicacionDispositivoService({ usuarioId, token, latitud, longitud, precision_ubicacion_m }) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken || !validateCoordinates({ latitud, longitud, precision_ubicacion_m })) {
    const error = new Error('Token y coordenadas válidas son requeridos');
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.dispositivoPush.updateMany({
    where: { token: normalizedToken, usuario_id: usuarioId },
    data: {
      latitud,
      longitud,
      precision_ubicacion_m: precision_ubicacion_m ?? null,
      ubicacion_actualizada: new Date(),
    },
  });

  if (result.count === 0) {
    const error = new Error('Dispositivo no registrado para este usuario');
    error.statusCode = 404;
    throw error;
  }

  return result;
}

export async function eliminarDispositivoService({ usuarioId, token }) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    const error = new Error('Se requiere el token FCM');
    error.statusCode = 400;
    throw error;
  }

  return prisma.dispositivoPush.deleteMany({
    where: { token: normalizedToken, usuario_id: usuarioId },
  });
}

export async function obtenerPreferenciasService({ usuarioId }) {
  return prisma.preferenciasPush.upsert({
    where: { usuario_id: usuarioId },
    create: { usuario_id: usuarioId },
    update: {},
    select: {
      avistamientos_cercanos: true,
      retos_por_vencer: true,
      actividad_avistamientos: true,
    },
  });
}

export async function actualizarPreferenciasService({ usuarioId, body }) {
  const data = buildPreferenceUpdate(body);

  if (Object.keys(data).length === 0) {
    const error = new Error('Se requiere al menos una preferencia');
    error.statusCode = 400;
    throw error;
  }

  return prisma.preferenciasPush.upsert({
    where: { usuario_id: usuarioId },
    create: { usuario_id: usuarioId, ...data },
    update: data,
    select: {
      avistamientos_cercanos: true,
      retos_por_vencer: true,
      actividad_avistamientos: true,
    },
  });
}
