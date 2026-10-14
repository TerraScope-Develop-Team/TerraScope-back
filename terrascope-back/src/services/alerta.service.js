import prisma from "../config/db.js";

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const normalizeAlertCoordinates = ({ latitud, longitud }) => {
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) return false;
  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) return false;
  return true;
};

export const buildAlertState = (alertId, userId, mostrada = true) => ({
  id: `${alertId}_${userId}`,
  id_alerta: alertId,
  id_usuario: userId,
  mostrada,
  leida: false,
});

export const buildAlertSummary = (alertas = [], estadosPorAlerta = new Map()) =>
  (alertas || []).map((alerta) => ({
    ...alerta,
    mostrada: estadosPorAlerta.get(alerta.id)?.mostrada ?? false,
    leida: estadosPorAlerta.get(alerta.id)?.leida ?? false,
  }));

export const buildSosAlertData = ({ userId, latitud, longitud }) => ({
  id_usuario: userId,
  latitud,
  longitud,
  estado: 'pendiente',
});

export const buildUserLocationUpdateData = ({ latitud, longitud }) => ({
  ultima_ubicacion_lat: latitud,
  ultima_ubicacion_lng: longitud,
  ultima_actualizacion_ubicacion: new Date(),
});

export const buildAlertSettingsUpdate = ({ recibir_alertas_peligro }) => ({
  recibir_alertas_peligro,
});

export const isValidAlertId = (alertId) => /^[a-f\d]{24}$/i.test(String(alertId || ''));

export const buildReadAlertState = (alertId, userId) => ({
  id: `${alertId}_${userId}`,
  id_alerta: alertId,
  id_usuario: userId,
  mostrada: true,
  leida: true,
});

export const registerSosService = async ({ userId, latitud, longitud }) => {
  const sos = await prisma.alertaSOS.create({
    data: buildSosAlertData({ userId, latitud, longitud }),
  });

  await prisma.usuario.update({
    where: { id: userId },
    data: buildUserLocationUpdateData({ latitud, longitud }),
  });

  return sos;
};

export const getSOSAlertsService = async () => prisma.alertaSOS.findMany({
  orderBy: { createdAt: 'desc' },
  take: 50,
});

export const getDangerousFaunaAlertsService = async ({ userId }) => {
  const alertas = await prisma.alertaPeligro.findMany({
    where: { usuarios_notificados: { has: userId } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const estados = await prisma.estadoAlertaUsuario.findMany({
    where: {
      id_usuario: userId,
      id_alerta: { in: alertas.map(({ id }) => id) },
    },
  });

  const estadosPorAlerta = new Map(
    estados.map(({ id_alerta, mostrada, leida }) => [id_alerta, { mostrada, leida }])
  );

  return {
    alertas: buildAlertSummary(alertas, estadosPorAlerta),
    total: alertas.length,
  };
};

export const markDangerousFaunaAlertShownService = async ({ userId, alertId }) => {
  const alert = await prisma.alertaPeligro.findUnique({ where: { id: alertId } });

  if (!alert || !alert.usuarios_notificados.includes(userId)) {
    const error = new Error('Alerta no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const stateId = `${alertId}_${userId}`;
  const where = { id: stateId };
  const existingState = await prisma.estadoAlertaUsuario.findUnique({ where });

  if (existingState?.mostrada) {
    return false;
  }

  if (existingState) {
    await prisma.estadoAlertaUsuario.update({
      where,
      data: { mostrada: true },
    });
    return true;
  }

  try {
    await prisma.estadoAlertaUsuario.create({ data: buildAlertState(alertId, userId, true) });
    return true;
  } catch (error) {
    if (error.code === 'P2002') {
      return false;
    }
    throw error;
  }
};

export const markDangerousFaunaAlertReadService = async ({ userId, alertId }) => {
  const alert = await prisma.alertaPeligro.findUnique({ where: { id: alertId } });

  if (!alert || !alert.usuarios_notificados.includes(userId)) {
    const error = new Error('Alerta no encontrada');
    error.statusCode = 404;
    throw error;
  }

  await prisma.estadoAlertaUsuario.upsert({
    where: { id: `${alertId}_${userId}` },
    create: buildReadAlertState(alertId, userId),
    update: { leida: true },
  });

  return true;
};

export const getNearbyDangerousAlertsService = async ({ userId, latitude, longitude }) => {
  const ayer = new Date();
  ayer.setHours(ayer.getHours() - 24);
  const objectIdAyer = Math.floor(ayer.getTime() / 1000).toString(16) + '0000000000000000';

  const peligrososRecientes = await prisma.faunaFlora.findMany({
    where: {
      es_peligrosa: true,
      id: { gte: objectIdAyer },
    },
  });

  const radioKm = 10;
  const cercanos = peligrososRecientes.filter((avistamiento) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      avistamiento.ubicacion.latitud,
      avistamiento.ubicacion.longitud,
    );
    return distance <= radioKm;
  });

  const alertas = [];
  for (const avistamiento of cercanos) {
    let alerta = await prisma.alertaPeligro.findFirst({
      where: {
        id_avistamiento: avistamiento.id,
        usuarios_notificados: { has: userId },
      },
    });

    if (!alerta) {
      const existingAlert = await prisma.alertaPeligro.findFirst({
        where: { id_avistamiento: avistamiento.id },
      });

      if (existingAlert) {
        alerta = await prisma.alertaPeligro.update({
          where: { id: existingAlert.id },
          data: { usuarios_notificados: { push: userId } },
        });
      } else {
        alerta = await prisma.alertaPeligro.create({
          data: {
            id_avistamiento: avistamiento.id,
            especie: avistamiento.especie,
            latitud: avistamiento.ubicacion.latitud,
            longitud: avistamiento.ubicacion.longitud,
            usuarios_notificados: [userId],
          },
        });
      }
    }

    alertas.push(alerta);
  }

  return { alertas, total: alertas.length };
};

export const updateAlertSettingsService = async ({ userId, recibir_alertas_peligro }) => prisma.usuario.update({
  where: { id: userId },
  data: buildAlertSettingsUpdate({ recibir_alertas_peligro }),
  select: { id: true, recibir_alertas_peligro: true },
});

export const updateUserLocationService = async ({ userId, latitud, longitud }) => prisma.usuario.update({
  where: { id: userId },
  data: buildUserLocationUpdateData({ latitud, longitud }),
});
