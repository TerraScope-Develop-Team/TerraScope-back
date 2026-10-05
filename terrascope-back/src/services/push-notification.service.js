import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import prisma from "../config/db.js";
import { distanceInMeters } from "../utils/geo.js";

const preferenceFieldByCategory = {
  nearby: "avistamientos_cercanos",
  challenge: "retos_por_vencer",
  activity: "actividad_avistamientos"
};

const initializeMessaging = () => {
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) return getMessaging(existingApps[0]);

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return getMessaging(initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      }));
    }

    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath) {
      if (credentialsPath.trimStart().startsWith("{")) {
        try {
          const serviceAccount = JSON.parse(credentialsPath);
          if (
            serviceAccount.type !== "service_account" ||
            !serviceAccount.project_id ||
            !serviceAccount.private_key ||
            !serviceAccount.client_email
          ) {
            throw new Error("El JSON no contiene los campos requeridos de una cuenta de servicio.");
          }
          return getMessaging(initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id
          }));
        } catch (error) {
          console.error(
            "FCM desactivado: GOOGLE_APPLICATION_CREDENTIALS parece contener JSON inline, no una ruta. " +
            "Usa FIREBASE_SERVICE_ACCOUNT_JSON para JSON en una sola línea, o configura aquí la ruta a un archivo JSON válido. " +
            error.message
          );
          return null;
        }
      }

      const resolvedCredentialsPath = resolve(credentialsPath);
      if (!existsSync(resolvedCredentialsPath)) {
        console.error(
          `FCM desactivado: GOOGLE_APPLICATION_CREDENTIALS no existe en ${resolvedCredentialsPath}`
        );
        return null;
      }
    }

    if (credentialsPath || process.env.FIREBASE_PROJECT_ID) {
      return getMessaging(initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
      }));
    }

    console.warn(
      "FCM desactivado: configura FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_PROJECT_ID."
    );
  } catch (error) {
    console.error("FCM no se pudo inicializar; los envíos push permanecerán desactivados:", error.message);
  }

  return null;
};

const messaging = initializeMessaging();
const invalidTokenCodes = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered"
]);
const NEARBY_RADIUS_METERS = 2_000;

const pushService = {
  async enviarAUsuario({
    usuarioId,
    categoria,
    claveEvento,
    tipo,
    destinoId,
    titulo,
    cuerpo,
    datos = {},
    tokensObjetivo
  }) {
    if (!messaging) return { enviado: false, motivo: "fcm_no_configurado" };

    let entrega;
    let successCount = 0;
    try {
      const preferencias = await prisma.preferenciasPush.findUnique({
        where: { usuario_id: usuarioId }
      });
      const campoPreferencia = preferenceFieldByCategory[categoria];
      if (campoPreferencia && preferencias?.[campoPreferencia] === false) {
        return { enviado: false, motivo: "preferencia_desactivada" };
      }

      const tokens = tokensObjetivo ?? (await prisma.dispositivoPush.findMany({
        where: { usuario_id: usuarioId },
        select: { token: true }
      })).map(({ token }) => token);
      if (tokens.length === 0) return { enviado: false, motivo: "sin_dispositivos" };

      const claveUnica = `${tipo}:${claveEvento}:${usuarioId}`;
      try {
        entrega = await prisma.entregaNotificacion.create({
          data: {
            clave_unica: claveUnica,
            usuario_id: usuarioId,
            tipo,
            destino_id: destinoId
          }
        });
      } catch (error) {
        if (error.code === "P2002") return { enviado: false, motivo: "duplicado" };
        throw error;
      }

      const data = Object.fromEntries(
        Object.entries(datos).map(([key, value]) => [
          key,
          value === null || value === undefined
            ? ""
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value)
        ])
      );
      const failures = [];
      const invalidTokens = [];

      for (let offset = 0; offset < tokens.length; offset += 500) {
        const batch = tokens.slice(offset, offset + 500);
        const result = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title: titulo, body: cuerpo },
          data
        });

        successCount += result.successCount;
        result.responses.forEach((response, index) => {
          if (response.success) return;

          const code = response.error?.code || "messaging/unknown-error";
          failures.push(code);
          if (invalidTokenCodes.has(code)) {
            invalidTokens.push(batch[index]);
          }
        });
      }

      if (invalidTokens.length > 0) {
        try {
          await prisma.dispositivoPush.deleteMany({
            where: {
              usuario_id: usuarioId,
              token: { in: invalidTokens }
            }
          });
        } catch (error) {
          console.error("No se pudieron eliminar tokens FCM inválidos:", error.message);
        }
      }

      await prisma.entregaNotificacion.update({
        where: { id: entrega.id },
        data: {
          estado: successCount > 0 ? "enviado" : "fallido",
          enviado_en: successCount > 0 ? new Date() : null,
          error: failures.length > 0 ? failures.join(",").slice(0, 500) : null
        }
      });

      return {
        enviado: successCount > 0,
        dispositivos: successCount,
        fallos: failures.length,
        ...(successCount === 0 ? { motivo: "fcm_rechazo" } : {})
      };
    } catch (error) {
      if (entrega) {
        try {
          await prisma.entregaNotificacion.update({
            where: { id: entrega.id },
            data: {
              estado: successCount > 0 ? "enviado" : "fallido",
              enviado_en: successCount > 0 ? new Date() : null,
              error: (error.message || "Error desconocido al enviar FCM").slice(0, 500)
            }
          });
        } catch (updateError) {
          console.error("No se pudo actualizar el estado de la entrega push:", updateError.message);
        }
      }
      console.error("Error al enviar notificación push:", error.message);
      return { enviado: false, motivo: "error_envio" };
    }
  },

  async notificarAvistamientoCercano(avistamiento) {
    try {
      const latitude = avistamiento.ubicacion?.latitud;
      const longitude = avistamiento.ubicacion?.longitud;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return {
          enviado: 0,
          ubicaciones_elegibles: 0,
          usuarios_en_radio: 0,
          motivo: "avistamiento_sin_coordenadas"
        };
      }

      const maxAgeHours = Number(process.env.PUSH_LOCATION_MAX_AGE_HOURS || 24);
      const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const dispositivos = await prisma.dispositivoPush.findMany({
        where: {
          ubicacion_actualizada: { gte: since },
          latitud: { not: null },
          longitud: { not: null },
          ...(avistamiento.id_usuario ? { usuario_id: { not: avistamiento.id_usuario } } : {})
        },
        select: { usuario_id: true, token: true, latitud: true, longitud: true }
      });

      const tokensPorUsuario = new Map();
      for (const device of dispositivos) {
        if (distanceInMeters(latitude, longitude, device.latitud, device.longitud) <= NEARBY_RADIUS_METERS) {
          const tokens = tokensPorUsuario.get(device.usuario_id) || [];
          tokens.push(device.token);
          tokensPorUsuario.set(device.usuario_id, tokens);
        }
      }

      const destinatarios = [...tokensPorUsuario.entries()];
      const resumen = {
        enviado: 0,
        fallidos: 0,
        omitidos: 0,
        motivos_omitidos: {},
        ubicaciones_elegibles: dispositivos.length,
        dispositivos_en_radio: [...tokensPorUsuario.values()]
          .reduce((total, tokens) => total + tokens.length, 0),
        usuarios_en_radio: destinatarios.length,
        radio_metros: NEARBY_RADIUS_METERS
      };

      if (destinatarios.length === 0) {
        resumen.motivo = dispositivos.length === 0
          ? "sin_ubicaciones_recientes"
          : "sin_usuarios_en_radio";
        console.info("Resultado de notificación cercana:", {
          avistamientoId: avistamiento.id,
          ...resumen
        });
        return resumen;
      }

      for (let offset = 0; offset < destinatarios.length; offset += 50) {
        const resultados = await Promise.all(destinatarios.slice(offset, offset + 50).map(([usuarioId, tokensObjetivo]) =>
          this.enviarAUsuario({
            usuarioId,
            categoria: "nearby",
            claveEvento: `sighting:${avistamiento.id}`,
            tipo: "avistamiento_cercano",
            destinoId: avistamiento.id,
            titulo: "Nuevo avistamiento cercano",
            cuerpo: `${avistamiento.nombre_comun} fue registrado cerca de ti.`,
            datos: { type: "sighting_nearby", targetId: avistamiento.id },
            tokensObjetivo
          })
        ));
        for (const resultado of resultados) {
          if (resultado.enviado) {
            resumen.enviado += resultado.dispositivos || 0;
          } else if (resultado.motivo === "fcm_rechazo" || resultado.motivo === "error_envio") {
            resumen.fallidos += 1;
          } else {
            resumen.omitidos += 1;
            const motivo = resultado.motivo || "sin_motivo";
            resumen.motivos_omitidos[motivo] =
              (resumen.motivos_omitidos[motivo] || 0) + 1;
          }
        }
      }

      console.info("Resultado de notificación cercana:", {
        avistamientoId: avistamiento.id,
        ...resumen
      });
      return resumen;
    } catch (error) {
      console.error("Error buscando destinatarios de avistamientos cercanos:", error.message);
      return {
        enviado: 0,
        ubicaciones_elegibles: 0,
        usuarios_en_radio: 0,
        motivo: "error_busqueda"
      };
    }
  },

  async notificarComentario({ avistamiento, comentario }) {
    if (!avistamiento.id_usuario || comentario.id_usuario === avistamiento.id_usuario) return;

    return this.enviarAUsuario({
      usuarioId: avistamiento.id_usuario,
      categoria: "activity",
      claveEvento: `comment:${avistamiento.id}:${comentario.id}`,
      tipo: "comentario_avistamiento",
      destinoId: avistamiento.id,
      titulo: "Nuevo comentario",
      cuerpo: `${comentario.nombre_usuario} comentó tu avistamiento.`,
      datos: { type: "sighting_comment", targetId: avistamiento.id }
    });
  },

  async notificarLike({ avistamiento, actorId, eventoId }) {
    if (!avistamiento.id_usuario) {
      return { enviado: false, motivo: "avistamiento_sin_propietario" };
    }
    if (String(actorId) === String(avistamiento.id_usuario)) {
      return { enviado: false, motivo: "like_propio" };
    }

    return this.enviarAUsuario({
      usuarioId: avistamiento.id_usuario,
      categoria: "activity",
      claveEvento: `like:${avistamiento.id}:${actorId}:${eventoId}`,
      tipo: "like_avistamiento",
      destinoId: avistamiento.id,
      titulo: "Nuevo me gusta",
      cuerpo: "A alguien le gustó tu avistamiento.",
      datos: { type: "sighting_like", targetId: avistamiento.id }
    });
  },

  async notificarRetoPorVencer({ usuarioId, reto }) {
    return this.enviarAUsuario({
      usuarioId,
      categoria: "challenge",
      claveEvento: `challenge:${reto.id}:${reto.fecha_final?.toISOString()}`,
      tipo: "reto_por_vencer",
      destinoId: reto.id,
      titulo: "Reto próximo a vencer",
      cuerpo: `Te quedan 24 horas para completar ${reto.nombre_reto}.`,
      datos: { type: "challenge_expiring", targetId: reto.id }
    });
  }
};

export default pushService;