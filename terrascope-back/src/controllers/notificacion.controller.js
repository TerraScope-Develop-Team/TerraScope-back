import {
  actualizarPreferenciasService,
  actualizarUbicacionDispositivoService,
  eliminarDispositivoService,
  getAuthenticatedUserId,
  getRequestBody,
  obtenerPreferenciasService,
  registrarDispositivoService,
} from "../services/notificacion.service.js";

export const registrarDispositivo = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const { token, plataforma, latitud, longitud, precision_ubicacion_m } = getRequestBody(req);

    const device = await registrarDispositivoService({
      usuarioId,
      token,
      plataforma,
      latitud,
      longitud,
      precision_ubicacion_m,
    });

    res.status(200).json({ message: "Dispositivo registrado", dispositivo: device });
  } catch (error) {
    console.error("Error registrando dispositivo push:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "No se pudo registrar el dispositivo" });
  }
};

export const actualizarUbicacionDispositivo = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const { token, latitud, longitud, precision_ubicacion_m } = getRequestBody(req);

    await actualizarUbicacionDispositivoService({
      usuarioId,
      token,
      latitud,
      longitud,
      precision_ubicacion_m,
    });

    res.status(200).json({ message: "Ubicación actualizada" });
  } catch (error) {
    console.error("Error actualizando ubicación push:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "No se pudo actualizar la ubicación" });
  }
};

export const eliminarDispositivo = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const { token } = getRequestBody(req);

    await eliminarDispositivoService({ usuarioId, token });

    res.status(200).json({ message: "Dispositivo eliminado" });
  } catch (error) {
    console.error("Error eliminando dispositivo push:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "No se pudo eliminar el dispositivo" });
  }
};

export const obtenerPreferencias = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const preferencias = await obtenerPreferenciasService({ usuarioId });

    res.status(200).json(preferencias);
  } catch (error) {
    console.error("Error obteniendo preferencias push:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "No se pudieron obtener las preferencias" });
  }
};

export const actualizarPreferencias = async (req, res) => {
  try {
    const usuarioId = getAuthenticatedUserId(req);
    const body = getRequestBody(req);

    const preferencias = await actualizarPreferenciasService({ usuarioId, body });

    res.status(200).json(preferencias);
  } catch (error) {
    console.error("Error actualizando preferencias push:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "No se pudieron actualizar las preferencias" });
  }
};