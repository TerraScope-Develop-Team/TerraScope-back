import prisma from "../config/db.js";
import { respondWithError, respondWithControllerError } from "../utils/controller-error.js";

// Calcular distancia entre dos coordenadas usando Haversine (en km)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Registrar un SOS
export const registerSOS = async (req, res) => {
  try {
    const { latitud, longitud } = req.body;
    const userId = req.usuario?.id;

    if (!latitud || !longitud) {
      return respondWithError(res, 400, "MISSING_LOCATION", "Se requiere latitud y longitud para el SOS");
    }

    if (!userId) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Debes estar autenticado para enviar un SOS");
    }

    const sos = await prisma.alertaSOS.create({
      data: {
        id_usuario: userId,
        latitud,
        longitud,
        estado: "pendiente"
      }
    });

    // Actualizar también la última ubicación del usuario
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        ultima_ubicacion_lat: latitud,
        ultima_ubicacion_lng: longitud,
        ultima_actualizacion_ubicacion: new Date()
      }
    });

    const io = req.app.get("io");
    if (io) {
      // Emitir a una sala "admins" o a todos para simplificar el MVP
      io.emit("nuevaAlertaSOS", sos);
    }

    res.status(201).json({
      message: "Alerta SOS registrada con éxito",
      sos
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al registrar SOS");
  }
};

// Obtener alertas SOS (para admin o dashboards)
export const getSOSAlerts = async (req, res) => {
  try {
    const alertas = await prisma.alertaSOS.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
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

    // Buscar alertas donde el usuario haya sido notificado
    const alertas = await prisma.alertaPeligro.findMany({
      where: {
        usuarios_notificados: { has: userId }
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // Últimas 20 alertas
    });

    res.status(200).json({
      alertas,
      total: alertas.length
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener alertas de fauna");
  }
};

// Obtener avistamientos peligrosos recientes cercanos (para cuando el usuario abre la app/mapa)
export const getNearbyDangerousAlerts = async (req, res) => {
  try {
    const { latitud, longitud } = req.query;
    
    if (!latitud || !longitud) {
      return respondWithError(res, 400, "MISSING_LOCATION", "Se requieren latitud y longitud");
    }

    // Buscar avistamientos peligrosos de las últimas 24 horas usando ObjectId
    const ayer = new Date();
    ayer.setHours(ayer.getHours() - 24);
    const objectIdAyer = Math.floor(ayer.getTime() / 1000).toString(16) + "0000000000000000";

    const peligrososRecientes = await prisma.faunaFlora.findMany({
      where: {
        es_peligrosa: true,
        id: { gte: objectIdAyer }
      }
    });

    // Filtrar por distancia (radio de 10km)
    const radioKm = 10;
    const cercanos = peligrososRecientes.filter(avistamiento => {
      const distance = calculateDistance(
        parseFloat(latitud), parseFloat(longitud),
        avistamiento.ubicacion.latitud, avistamiento.ubicacion.longitud
      );
      return distance <= radioKm;
    });

    res.status(200).json({
      alertas: cercanos,
      total: cercanos.length
    });
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

    const usuario = await prisma.usuario.update({
      where: { id: userId },
      data: { recibir_alertas_peligro },
      select: { id: true, recibir_alertas_peligro: true }
    });

    res.status(200).json({
      message: "Configuración de alertas actualizada",
      usuario
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

    if (!latitud || !longitud) {
      return respondWithError(res, 400, "MISSING_LOCATION", "Se requiere latitud y longitud");
    }

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        ultima_ubicacion_lat: latitud,
        ultima_ubicacion_lng: longitud,
        ultima_actualizacion_ubicacion: new Date()
      }
    });

    res.status(200).json({ message: "Ubicación actualizada correctamente" });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al actualizar ubicación");
  }
};
