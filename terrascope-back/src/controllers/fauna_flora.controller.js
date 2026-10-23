import { randomUUID } from "node:crypto";
import prisma from "../config/db.js";
import {
  addComentarioService,
  buildComentarioPayload,
  buildFaunaFloraFilter,
  createFaunaFloraService,
  deleteAvistamientoService,
  deleteComentarioService,
  formatAvistamientoMetrics,
  getAvistamientoByIdService,
  getAvistamientoRecommendationsService,
  getFeedAvistamientosService,
  listFaunaFloraService,
  obtenerEstadoValidacionService,
  procesarVotacionesVencidasService,
  toggleLikeAvistamientoService,
  validarPorExpertoService,
  validateFaunaFloraInput,
  votarValidacionService,
} from "../services/fauna_flora.service.js";
import retosService from "../services/retos.service.js";
import { calculateDistance } from "../services/alerta.service.js";
import { parsePagination, paginateResults } from "../utils/pagination.js";

const FREQUENT_ZONES_CACHE_TTL_MS = 30_000;
let frequentZonesCache = { data: null, expiresAt: 0, pending: null };
import pushService from "../services/push-notification.service.js";

// Crear avistamiento
export const createAvistamiento = async (req, res) => {
  try {
    console.log('📥 Datos recibidos en createAvistamiento:');
    console.log(JSON.stringify(req.body, null, 2));

    const payload = validateFaunaFloraInput(req.body);
    const ubicacion = payload.ubicacion;
    const nuevoAvistamiento = await createFaunaFloraService(payload);

    console.log('✅ Avistamiento creado exitosamente:', nuevoAvistamiento.id);
    // Lógica para Alertas de Fauna Peligrosa
    if (nuevoAvistamiento.es_peligrosa) {
      try {
        const radiusKm = 10; // Radio de alerta en km
        const usersToAlert = await prisma.usuario.findMany({
          where: {
            recibir_alertas_peligro: true,
            ultima_ubicacion_lat: { not: null },
            ultima_ubicacion_lng: { not: null }
          }
        });
        
        const notifiedUserIds = [];
        for (const user of usersToAlert) {
          if (user.id === nuevoAvistamiento.id_usuario) continue; // No notificar al que reporta

          const distance = calculateDistance(
            ubicacion.latitud, ubicacion.longitud,
            user.ultima_ubicacion_lat, user.ultima_ubicacion_lng
          );
          if (distance <= radiusKm) {
            notifiedUserIds.push(user.id);
          }
        }

        if (notifiedUserIds.length > 0) {
          const alerta = await prisma.alertaPeligro.create({
            data: {
              id_avistamiento: nuevoAvistamiento.id,
              especie: nuevoAvistamiento.especie,
              latitud: ubicacion.latitud,
              longitud: ubicacion.longitud,
              usuarios_notificados: notifiedUserIds
            }
          });
          console.log(`⚠️ Alerta de peligro generada para ${notifiedUserIds.length} usuarios.`);
          
          // Emitir a los usuarios usando socket.io
          const io = req.app.get("io");
          if (io) {
            notifiedUserIds.forEach(uid => {
              io.to(uid).emit("nuevaAlertaPeligro", {
                ...alerta,
                nombre_comun: nuevoAvistamiento.nombre_comun,
                nombre_cientifico: nuevoAvistamiento.nombre_cientifico,
              });
            });
          }
        }
      } catch (alertError) {
        console.error("❌ Error generando alerta de peligro:", alertError);
      }
    }
    const notificacionesCercanas =
      await pushService.notificarAvistamientoCercano(nuevoAvistamiento);

    try {
      if (nuevoAvistamiento.id_usuario) {
        await retosService.actualizarHistorial(
          nuevoAvistamiento.id_usuario,
          nuevoAvistamiento.tipo,
          nuevoAvistamiento.especie
        );
      }
    } catch (error) {
      console.error("❌ Error actualizando historial:", error);
    }

    res.status(201).json({
      message: "Avistamiento creado exitosamente",
      data: nuevoAvistamiento,
      notificaciones_cercanas: notificacionesCercanas
    });

  } catch (error) {
    console.error('❌ Error completo:', error);
    res.status(500).json({
      message: "Error al crear un avistamiento",
      error: error.message
    });
  }
};

// Obtener todos con filtros opcionales (enriquecidos con métricas sociales)
export const getAvistamientos = async (req, res) => {
  try {
    const { especie, categoria, usuarioId, id_usuario, buscar } = req.query;
    const currentUserId = req.usuario?.id?.toString() || usuarioId || id_usuario;
    const pagination = parsePagination(req.query, 100);

    if (!pagination.validCursor) {
      return res.status(400).json({ message: "El cursor debe ser un ObjectId válido" });
    }

    const filter = buildFaunaFloraFilter({
      especie,
      categoria,
      buscar,
      cursor: pagination.cursor,
    });

    const records = await listFaunaFloraService({
      filter,
      limit: pagination.limit,
      currentUserId,
    });
    const { items: avistamientos } = paginateResults(res, records, pagination.limit);

    const formatted = avistamientos.map((item) => formatAvistamientoMetrics(item, currentUserId));

    res.status(200).json(formatted);
  } catch (error) {
    console.error('❌ Error al obtener avistamientos:', error);
    res.status(500).json({
      message: "Error al conseguir los avistamientos",
      error: error.message
    });
  }
};

export const getAvistamientoRecommendations = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ message: 'El identificador de avistamiento no es válido' });
    }

    const result = await getAvistamientoRecommendationsService({ avistamientoId: id });
    res.status(200).json(result);
  } catch (error) {
    console.error('Error al obtener recomendaciones de avistamientos:', error);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Error al obtener recomendaciones',
    });
  }
};

// Obtener por ID (enriquecido con métricas sociales)
export const getAvistamientoById = async (req, res) => {
  try {
    const { usuarioId, id_usuario } = req.query;
    const currentUserId = req.usuario?.id?.toString() || usuarioId || id_usuario;

    const avistamiento = await getAvistamientoByIdService({
      id: req.params.id,
      currentUserId,
    });

    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    res.status(200).json(avistamiento);
  } catch (error) {
    console.error('❌ Error al obtener avistamiento:', error);
    res.status(500).json({
      message: "Error al obtener el avistamiento",
      error: error.message
    });
  }
};

// Agregar comentario (asociado a avistamiento y autor con fecha/hora)
export const addComentario = async (req, res) => {
  try {
    const { comentario } = req.body;
    const autorId = req.usuario?.id || req.body.id_usuario;
    const autorNombre = req.usuario?.nombre_usuario || req.body.nombre_usuario;
    const autorAvatar = req.usuario?.imagen_perfil || req.body.imagen_perfil || "";

    const { avistamiento, comentarioCreado, updatedAvistamiento } = await addComentarioService({
      avistamientoId: req.params.id,
      comentario,
      autorId,
      autorNombre,
      autorAvatar,
    });

    await pushService.notificarComentario({ avistamiento, comentario: comentarioCreado });

    res.status(201).json({
      message: "Comentario agregado exitosamente",
      comentario: comentarioCreado,
      total_comentarios: updatedAvistamiento.comentarios.length,
      avistamientoId: updatedAvistamiento.id,
      data: updatedAvistamiento
    });
  } catch (error) {
    console.error("❌ Error al agregar comentario:", error);
    const status = error.statusCode || 500;
    const message = error.message || "Error al agregar comentario";
    res.status(status).json({ message, error: message });
  }
};

export const deleteAvistamiento = async (req, res) => {
  try {
    await deleteAvistamientoService({ id: req.params.id });
    res.status(200).json({ message: "Avistamiento eliminado correctamente" });
  } catch (error) {
    console.error('❌ Error al eliminar avistamiento:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al eliminar avistamiento",
      error: error.message || "Error al eliminar avistamiento"
    });
  }
};

export const getFrequentZones = async (req, res) => {
  try {
    if (frequentZonesCache.data && Date.now() < frequentZonesCache.expiresAt) {
      res.set("Cache-Control", "public, max-age=30");
      return res.status(200).json(frequentZonesCache.data);
    }

    if (!frequentZonesCache.pending) {
      frequentZonesCache.pending = prisma.faunaFlora.aggregateRaw({
        pipeline: [
          {
            $group: {
              _id: { lat: "$ubicacion.latitud", lng: "$ubicacion.longitud", especie: "$especie" },
              count: { $sum: 1 }
            }
          },
          { $match: { count: { $gt: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 500 },
          {
            $project: {
              lat: "$_id.lat",
              lng: "$_id.lng",
              especie: "$_id.especie",
              count: 1,
              _id: 0
            }
          }
        ]
      }).then((data) => {
        frequentZonesCache.data = data;
        frequentZonesCache.expiresAt = Date.now() + FREQUENT_ZONES_CACHE_TTL_MS;
        return data;
      }).finally(() => {
        frequentZonesCache.pending = null;
      });
    }

    const frequentZones = await frequentZonesCache.pending;
    res.set("Cache-Control", "public, max-age=30");
    res.status(200).json(frequentZones);
  } catch (error) {
    console.error('❌ Error al obtener zonas frecuentes:', error);
    res.status(500).json({
      message: "Error al obtener zonas frecuentes",
      error: error.message
    });
  }
};

// Votar por comunidad (positivo o negativo)
export const votarValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const id_usuario = req.usuario?.id || req.user?.id || req.body?.id_usuario;
    const tipoVoto =
      req.body?.tipo_voto ??
      req.body?.tipoVoto ??
      req.body?.voto ??
      req.query?.tipo_voto ??
      "positivo";

    if (!id_usuario) {
      return res.status(400).json({ message: "Se requiere el id_usuario" });
    }

    const resultado = await votarValidacionService({
      avistamientoId,
      userId: id_usuario,
      tipoVoto,
    });

    if (resultado.eliminado) {
      const io = req.app?.get("io");
      if (io) {
        io.emit("avistamientoEliminado", {
          id: avistamientoId,
          motivo: resultado.motivo,
        });
      }

      return res.status(200).json({
        message:
          resultado.motivo === "sin_votos"
            ? "El periodo de votación finalizó sin votos y el avistamiento fue eliminado automáticamente"
            : "El avistamiento alcanzó mayoría de votos negativos y fue eliminado automáticamente",
        eliminado: true,
        vencido: !!resultado.vencido,
        motivo: resultado.motivo,
        tipo_voto: resultado.tipo_voto || null,
        estado_actual: "eliminado",
        votos_comunidad: resultado.votos_comunidad,
        votos_positivos: resultado.votos_positivos,
        votos_negativos: resultado.votos_negativos,
        requeridos_comunidad: resultado.requeridos_comunidad,
      });
    }

    if (resultado.vencido) {
      return res.status(200).json({
        message:
          "El periodo de votación concluyó con mayoría positiva y el avistamiento quedó validado por la comunidad",
        eliminado: false,
        vencido: true,
        motivo: resultado.motivo,
        estado_actual: resultado.estado_actual,
        votos_comunidad: resultado.votos_comunidad,
        votos_positivos: resultado.votos_positivos,
        votos_negativos: resultado.votos_negativos,
        requeridos_comunidad: resultado.requeridos_comunidad,
      });
    }

    res.status(200).json({
      message: "Voto registrado correctamente",
      eliminado: false,
      vencido: false,
      tipo_voto: resultado.tipo_voto,
      estado_actual: resultado.validacion.estado,
      votos_comunidad: resultado.validacion.votos_comunidad,
      votos_positivos: resultado.validacion.votos_positivos,
      votos_negativos: resultado.validacion.votos_negativos,
      requeridos_comunidad: resultado.validacion.requeridos_comunidad,
      fecha_inicio_votacion: resultado.validacion.fecha_inicio_votacion,
      fecha_fin_votacion: resultado.validacion.fecha_fin_votacion,
    });
  } catch (error) {
    console.error("❌ Error al registrar voto:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al registrar el voto",
      error: error.message || "Error al registrar el voto",
    });
  }
};

// Validación por experto
export const validarPorExperto = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const id_usuario = req.usuario?.id || req.user?.id || req.body?.id_usuario;
    const rol = req.usuario?.rol || req.user?.rol || req.body?.rol;

    const updatedAvistamiento = await validarPorExpertoService({
      avistamientoId,
      userId: id_usuario,
      rol,
    });

    res.status(200).json({
      message: "Avistamiento validado por experto",
      estado_actual: updatedAvistamiento.validacion.estado,
      votos_comunidad: updatedAvistamiento.validacion.votos_comunidad,
      votos_positivos: updatedAvistamiento.validacion.votos_positivos,
      votos_negativos: updatedAvistamiento.validacion.votos_negativos,
    });
  } catch (error) {
    console.error("❌ Error al validar por experto:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al validar por experto",
      error: error.message || "Error al validar por experto",
    });
  }
};

export const obtenerEstadoValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const userId = req.usuario?.id || req.query?.userId || req.body?.id_usuario;

    if (!userId) return res.status(400).json({ message: "Falta el userId" });

    const estado = await obtenerEstadoValidacionService({ avistamientoId, userId });

    res.status(200).json(estado);
  } catch (error) {
    console.error("❌ Error:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al obtener estado",
      error: error.message || "Error al obtener estado",
    });
  }
};

export const procesarVotacionesVencidas = async (req, res) => {
  try {
    const resultado = await procesarVotacionesVencidasService();
    res.status(200).json({
      message: "Votaciones vencidas procesadas correctamente",
      ...resultado,
    });
  } catch (error) {
    console.error("❌ Error al procesar votaciones vencidas:", error);
    res.status(500).json({
      message: "Error al procesar votaciones vencidas",
      error: error.message,
    });
  }
};

// Feed consolidado: Avistamientos de los usuarios a los que sigo
export const getFeedAvistamientos = async (req, res) => {
  try {
    const currentUserId = req.usuario?.id?.toString() || req.query.usuarioId || req.query.id_usuario;
    const pagination = parsePagination(req.query);

    if (!pagination.validCursor) {
      return res.status(400).json({ message: "El cursor debe ser un ObjectId válido" });
    }

    const { avistamientos, emptyFeed } = await getFeedAvistamientosService({
      currentUserId,
      cursor: pagination.cursor,
      limit: pagination.limit,
    });

    if (emptyFeed) {
      return res.status(200).json({
        message: "Aún no sigues a ningún usuario. Sigue a otros exploradores para ver sus avistamientos aquí.",
        feed: [],
        total: 0
      });
    }

    const { items: pageItems, hasMore, nextCursor } = paginateResults(res, avistamientos, pagination.limit);

    const feed = pageItems.map((item) => formatAvistamientoMetrics(item, currentUserId));

    res.status(200).json({
      message: "Feed obtenido exitosamente",
      feed,
      total: feed.length,
      has_more: hasMore,
      next_cursor: nextCursor
    });
  } catch (error) {
    console.error("❌ Error al obtener feed de avistamientos:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "Error al obtener el feed", error: error.message || "Error al obtener el feed" });
  }
};

// Alternar "like" en un avistamiento (dar y quitar sin duplicar)
export const toggleLikeAvistamiento = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.usuario?.id?.toString() || req.body.id_usuario || req.body.usuarioId;

    const { avistamiento, updatedAvistamiento, yaDioLike, liked } = await toggleLikeAvistamientoService({
      id,
      userId,
    });

    const push = yaDioLike
      ? { enviado: false, motivo: "like_removido" }
      : await pushService.notificarLike({
          avistamiento,
          actorId: userId,
          eventoId: randomUUID()
        });

    res.status(200).json({
      message: yaDioLike ? "Like removido" : "Like agregado exitosamente",
      liked,
      total_likes: updatedAvistamiento.likes.length,
      avistamientoId: updatedAvistamiento.id,
      push
    });
  } catch (error) {
    console.error("❌ Error al alternar like:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "Error al procesar el like", error: error.message || "Error al procesar el like" });
  }
};

// Eliminar comentario con moderación (Autor o Administrador)
export const deleteComentario = async (req, res) => {
  try {
    const { id, comentarioId } = req.params;
    const solicitanteId = req.usuario?.id?.toString() || req.body.id_usuario || req.query.id_usuario;

    if (!solicitanteId) {
      return res.status(401).json({ message: "Se requiere autenticación para eliminar un comentario" });
    }

    const { updatedAvistamiento, esAutor, esAdmin } = await deleteComentarioService({
      id,
      comentarioId,
      solicitanteId,
      rol: req.usuario?.rol,
    });

    res.status(200).json({
      message: esAdmin && !esAutor
        ? "Comentario eliminado por un Administrador (moderación)"
        : "Comentario eliminado exitosamente",
      comentarioId,
      total_comentarios: updatedAvistamiento.comentarios.length,
      avistamientoId: updatedAvistamiento.id
    });
  } catch (error) {
    console.error("❌ Error al eliminar comentario:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "Error al eliminar comentario", error: error.message || "Error al eliminar comentario" });
  }
};
