import prisma from "../config/db.js";

const preferenceFields = [
  "avistamientos_cercanos",
  "retos_por_vencer",
  "actividad_avistamientos"
];

const getAuthenticatedUserId = (req) => req.usuario?.id || req.user?.id;

const getRequestBody = (req) =>
  req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};

const normalizeToken = (token) => {
  if (typeof token !== "string") return null;
  const normalizedToken = token.trim();
  if (
    normalizedToken.length < 20 ||
    normalizedToken.length > 4096 ||
    /\s/.test(normalizedToken)
  ) {
    return null;
  }
  return normalizedToken;
};

const validateCoordinates = ({ latitud, longitud, precision_ubicacion_m }) => {
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) return false;
  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) return false;
  return precision_ubicacion_m === undefined || precision_ubicacion_m === null ||
    (Number.isFinite(precision_ubicacion_m) && precision_ubicacion_m >= 0);
};

export const registrarDispositivo = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const { token, plataforma, latitud, longitud, precision_ubicacion_m } = getRequestBody(req);
    const normalizedToken = normalizeToken(token);

    if (!normalizedToken) {
      return res.status(400).json({ message: "Se requiere un token FCM válido" });
    }

    if (plataforma !== undefined && plataforma !== null &&
      (typeof plataforma !== "string" || plataforma.trim().length === 0 || plataforma.length > 32)) {
      return res.status(400).json({ message: "La plataforma debe ser una cadena de hasta 32 caracteres" });
    }

    const hasLatitude = latitud !== undefined;
    const hasLongitude = longitud !== undefined;
    if (hasLatitude !== hasLongitude || (hasLatitude && !validateCoordinates({ latitud, longitud, precision_ubicacion_m }))) {
      return res.status(400).json({ message: "Las coordenadas o su precisión no son válidas" });
    }

    const locationData = hasLatitude ? {
      latitud,
      longitud,
      precision_ubicacion_m: precision_ubicacion_m ?? null,
      ubicacion_actualizada: new Date()
    } : {};

    const existingDevice = await prisma.dispositivoPush.findUnique({
      where: { token: normalizedToken },
      select: { usuario_id: true }
    });
    const deviceWasReassigned = existingDevice && existingDevice.usuario_id !== usuarioId;

    const device = await prisma.dispositivoPush.upsert({
      where: { token: normalizedToken },
      create: {
        token: normalizedToken,
        plataforma: plataforma?.trim() || null,
        usuario_id: usuarioId,
        latitud: hasLatitude ? latitud : null,
        longitud: hasLongitude ? longitud : null,
        precision_ubicacion_m: precision_ubicacion_m ?? null,
        ubicacion_actualizada: hasLatitude ? new Date() : null
      },
      update: {
        usuario_id: usuarioId,
        ...(plataforma !== undefined ? { plataforma: plataforma?.trim() || null } : {}),
        ...(deviceWasReassigned && !hasLatitude
          ? {
              latitud: null,
              longitud: null,
              precision_ubicacion_m: null,
              ubicacion_actualizada: null
            }
          : {}),
        ...locationData
      },
      select: { id: true, plataforma: true }
    });

    res.status(200).json({ message: "Dispositivo registrado", dispositivo: device });
  } catch (error) {
    console.error("Error registrando dispositivo push:", error);
    res.status(500).json({ message: "No se pudo registrar el dispositivo" });
  }
};

export const actualizarUbicacionDispositivo = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const { token, latitud, longitud, precision_ubicacion_m } = getRequestBody(req);
    const normalizedToken = normalizeToken(token);

    if (!normalizedToken || !validateCoordinates({ latitud, longitud, precision_ubicacion_m })) {
      return res.status(400).json({ message: "Token y coordenadas válidas son requeridos" });
    }

    const result = await prisma.dispositivoPush.updateMany({
      where: { token: normalizedToken, usuario_id: usuarioId },
      data: {
        latitud,
        longitud,
        precision_ubicacion_m: precision_ubicacion_m ?? null,
        ubicacion_actualizada: new Date()
      }
    });

    if (result.count === 0) {
      return res.status(404).json({ message: "Dispositivo no registrado para este usuario" });
    }

    res.status(200).json({ message: "Ubicación actualizada" });
  } catch (error) {
    console.error("Error actualizando ubicación push:", error);
    res.status(500).json({ message: "No se pudo actualizar la ubicación" });
  }
};

export const eliminarDispositivo = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const { token } = getRequestBody(req);
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) {
      return res.status(400).json({ message: "Se requiere el token FCM" });
    }

    await prisma.dispositivoPush.deleteMany({
      where: { token: normalizedToken, usuario_id: usuarioId }
    });

    res.status(200).json({ message: "Dispositivo eliminado" });
  } catch (error) {
    console.error("Error eliminando dispositivo push:", error);
    res.status(500).json({ message: "No se pudo eliminar el dispositivo" });
  }
};

export const obtenerPreferencias = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const preferencias = await prisma.preferenciasPush.upsert({
      where: { usuario_id: usuarioId },
      create: { usuario_id: usuarioId },
      update: {},
      select: {
        avistamientos_cercanos: true,
        retos_por_vencer: true,
        actividad_avistamientos: true
      }
    });

    res.status(200).json(preferencias);
  } catch (error) {
    console.error("Error obteniendo preferencias push:", error);
    res.status(500).json({ message: "No se pudieron obtener las preferencias" });
  }
};

export const actualizarPreferencias = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const body = getRequestBody(req);
    const data = {};

    for (const field of preferenceFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "boolean") {
          return res.status(400).json({ message: `${field} debe ser booleano` });
        }
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Se requiere al menos una preferencia" });
    }

    const preferencias = await prisma.preferenciasPush.upsert({
      where: { usuario_id: usuarioId },
      create: { usuario_id: usuarioId, ...data },
      update: data,
      select: {
        avistamientos_cercanos: true,
        retos_por_vencer: true,
        actividad_avistamientos: true
      }
    });

    res.status(200).json(preferencias);
  } catch (error) {
    console.error("Error actualizando preferencias push:", error);
    res.status(500).json({ message: "No se pudieron actualizar las preferencias" });
  }
};