import {
  getDangerousFaunaAlertsService,
  getNearbyDangerousAlertsService,
  getSOSAlertsService,
  isValidAlertId,
  markDangerousFaunaAlertReadService,
  markDangerousFaunaAlertShownService,
  normalizeAlertCoordinates,
  registerSosService,
  updateAlertSettingsService,
  updateUserLocationService,
} from "../services/alerta.service.js";
import { respondWithError, respondWithControllerError } from "../utils/controller-error.js";

// Registrar un SOS
export const registerSOS = async (req, res) => {
  try {
    const { latitud, longitud } = req.body;
    const userId = req.usuario?.id;

    if (!normalizeAlertCoordinates({ latitud, longitud })) {
      return respondWithError(res, 400, "MISSING_LOCATION", "Se requiere latitud y longitud para el SOS");
    }

    if (!userId) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Debes estar autenticado para enviar un SOS");
    }

    const sos = await registerSosService({ userId, latitud, longitud });

    const io = req.app.get("io");
    if (io) {
      io.emit("nuevaAlertaSOS", sos);
    }

    res.status(201).json({
      message: "Alerta SOS registrada con éxito",
      sos,
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al registrar SOS");
  }
};

// Obtener alertas SOS (para admin o dashboards)
export const getSOSAlerts = async (req, res) => {
  try {
    const alertas = await getSOSAlertsService();
    res.status(200).json(alertas);
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener alertas SOS");
  }
};

// Obtener historial de alertas de fauna peligrosa para un usuario
export const getDangerousFaunaAlerts = async (req, res) => {
  try {
    const userId = req.usuario?.id;

    if (!userId) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Usuario no autenticado");
    }

    const result = await getDangerousFaunaAlertsService({ userId });
    res.status(200).json(result);
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener alertas de fauna");
  }
};

// Registrar la primera presentación de una alerta para evitar banners repetidos.
export const markDangerousFaunaAlertShown = async (req, res) => {
  try {
    const userId = req.usuario?.id;
    const { alertId } = req.params;

    if (!userId) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Usuario no autenticado");
    }

    if (!isValidAlertId(alertId)) {
      return respondWithError(res, 400, "INVALID_ALERT_ID", "El identificador de alerta no es válido");
    }

    const mostrada = await markDangerousFaunaAlertShownService({ userId, alertId });
    return res.status(200).json({ mostrada });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al registrar la presentación de la alerta");
  }
};

// Registrar que el usuario abrió una alerta desde el centro de notificaciones.
export const markDangerousFaunaAlertRead = async (req, res) => {
  try {
    const userId = req.usuario?.id;
    const { alertId } = req.params;

    if (!userId) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Usuario no autenticado");
    }

    if (!isValidAlertId(alertId)) {
      return respondWithError(res, 400, "INVALID_ALERT_ID", "El identificador de alerta no es válido");
    }

    await markDangerousFaunaAlertReadService({ userId, alertId });
    res.status(200).json({ leida: true });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al marcar la alerta como leída");
  }
};

// Obtener avistamientos peligrosos recientes cercanos (para cuando el usuario abre la app/mapa)
export const getNearbyDangerousAlerts = async (req, res) => {
  try {
    const { latitud, longitud } = req.query;
    const userId = req.usuario?.id;
    const latitude = Number(latitud);
    const longitude = Number(longitud);

    if (!userId) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Usuario no autenticado");
    }

    if (!normalizeAlertCoordinates({ latitud: latitude, longitud: longitude })) {
      return respondWithError(res, 400, "MISSING_LOCATION", "Se requieren latitud y longitud");
    }

    const result = await getNearbyDangerousAlertsService({ userId, latitude, longitude });
    res.status(200).json(result);
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener alertas cercanas");
  }
};

// Actualizar configuración de alertas de un usuario
export const updateAlertSettings = async (req, res) => {
  try {
    const userId = req.usuario?.id;
    const { recibir_alertas_peligro } = req.body;

    if (!userId) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Usuario no autenticado");
    }

    if (recibir_alertas_peligro === undefined) {
      return respondWithError(res, 400, "MISSING_DATA", "Se requiere el estado de recibir_alertas_peligro");
    }

    const usuario = await updateAlertSettingsService({ userId, recibir_alertas_peligro });

    res.status(200).json({
      message: "Configuración de alertas actualizada",
      usuario,
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al actualizar configuración de alertas");
  }
};

// Actualizar última ubicación del usuario (ping en background o manual)
export const updateLocation = async (req, res) => {
  try {
    const userId = req.usuario?.id;
    const { latitud, longitud } = req.body;

    if (!userId) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Usuario no autenticado");
    }

    if (!normalizeAlertCoordinates({ latitud, longitud })) {
      return respondWithError(res, 400, "MISSING_LOCATION", "Se requiere latitud y longitud");
    }

    await updateUserLocationService({ userId, latitud, longitud });
    res.status(200).json({ message: "Ubicación actualizada correctamente" });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al actualizar ubicación");
  }
};
