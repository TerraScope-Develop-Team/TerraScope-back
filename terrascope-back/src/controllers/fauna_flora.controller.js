import FaunaFlora from "../models/fauna_flora.model.js";
import Habitat from "../models/habitat.model.js";
import Usuario from "../models/usuario.model.js";
import mongoose from "mongoose";
import retosService from "../services/retos.service.js";
import { respondWithControllerError, respondWithError } from "../utils/controller-error.js";

// Crear avistamiento
export const createAvistamiento = async (req, res) => {
  try {
    const {
      nombre_comun,
      nombre_cientifico,
      especie,
      descripcion,
      imagen,
      ubicacion,
      comportamiento,
      estado_extincion,
      estado_especimen,
      habitat,
      tipo,
      validacion
    } = req.body;

    // Validar que habitat existe y tiene id_habitat
    if (!habitat || !habitat.id_habitat) {
      return respondWithError(res, 400, "HABITAT_ID_REQUIRED", "El hábitat es requerido y debe tener un id_habitat");
    }

    if (!mongoose.Types.ObjectId.isValid(habitat.id_habitat)) {
      return respondWithError(res, 400, "INVALID_HABITAT_ID", "El ID del hábitat no tiene un formato válido");
    }

    const habitatExiste = await Habitat.findById(habitat.id_habitat);
    if (!habitatExiste) {
      return respondWithError(res, 404, "HABITAT_NOT_FOUND", "Hábitat no encontrado");
    }

    const habitatData = {
      id_habitat: new mongoose.Types.ObjectId(habitat.id_habitat),
      nombre_habitat: habitat.nombre_habitat,
      descripcion_habitat: habitat.descripcion_habitat
    };

    const nuevoAvistamiento = new FaunaFlora({
      nombre_comun,
      nombre_cientifico,
      especie,
      descripcion,
      imagen,
      ubicacion,
      comportamiento,
      estado_extincion,
      estado_especimen,
      habitat: habitatData,
      tipo,
      nombre_usuario: req.user.nombre_usuario,
      id_usuario: req.user._id,
      validacion: validacion || {
        estado: "pendiente",
        votos_comunidad: 0,
        requeridos_comunidad: 5,
        usuarios_validadores: [],
        validado_por_experto: false
      }
    });

    await nuevoAvistamiento.save();

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
      data: nuevoAvistamiento
    });
  } catch (error) {
    console.error('❌ Error completo:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return respondWithError(res, 400, "SIGHTING_VALIDATION_ERROR", "Los datos del avistamiento no son válidos", messages);
    }
    return respondWithControllerError(res, error, "Error al crear un avistamiento");
  }
};

// Obtener todos con filtros opcionales (enriquecidos con métricas sociales)
export const getAvistamientos = async (req, res) => {
  try {
    const { especie, categoria, usuarioId, id_usuario } = req.query;
    const currentUserId = req.user?._id?.toString() || usuarioId || id_usuario;
    let filter = {};
    if (especie) filter.especie = especie;
    if (categoria) {
      filter.especie = categoria;
    }
    const avistamientos = await FaunaFlora.find(filter)
      .sort({ createdAt: -1 })
      .populate("id_usuario", "nombre_usuario imagen_perfil");

    const formatted = avistamientos.map((item) => {
      const obj = item.toObject();
      obj.total_likes = item.likes ? item.likes.length : 0;
      obj.total_comentarios = item.comentarios ? item.comentarios.length : 0;
      obj.user_has_liked = currentUserId && item.likes
        ? item.likes.some((l) => l.toString() === currentUserId.toString())
        : false;
      return obj;
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error('❌ Error al obtener avistamientos:', error);
    return respondWithControllerError(res, error, "Error al conseguir los avistamientos");
  }
};

// Obtener por ID (enriquecido con métricas sociales)
export const getAvistamientoById = async (req, res) => {
  try {
    const { usuarioId, id_usuario } = req.query;
    const currentUserId = req.user?._id?.toString() || usuarioId || id_usuario;

    const avistamiento = await FaunaFlora.findById(req.params.id)
      .populate("id_usuario", "nombre_usuario imagen_perfil")
      .populate("comentarios.id_usuario", "nombre_usuario imagen_perfil");

    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    const obj = avistamiento.toObject();
    obj.total_likes = avistamiento.likes ? avistamiento.likes.length : 0;
    obj.total_comentarios = avistamiento.comentarios ? avistamiento.comentarios.length : 0;
    obj.user_has_liked = currentUserId && avistamiento.likes
      ? avistamiento.likes.some((l) => l.toString() === currentUserId.toString())
      : false;

    res.status(200).json(obj);
  } catch (error) {
    console.error('❌ Error al obtener avistamiento:', error);
    return respondWithControllerError(res, error, "Error al obtener el avistamiento");
  }
};

export const getAvistamientosCercanos = async (req, res) => {
  try {
    const latitud = Number(req.params.latitud);
    const longitud = Number(req.params.longitud);
    const distanciaKm = Number(req.params.distanciaKm);

    if (
      !Number.isFinite(latitud) || latitud < -90 || latitud > 90 ||
      !Number.isFinite(longitud) || longitud < -180 || longitud > 180 ||
      !Number.isFinite(distanciaKm) || distanciaKm <= 0
    ) {
      return respondWithError(res, 400, "INVALID_LOCATION_RANGE", "Coordenadas o distancia inválidas");
    }

    const latitudDelta = distanciaKm / 110.574;
    const longitudScale = Math.cos((latitud * Math.PI) / 180);
    const longitudDelta = longitudScale === 0
      ? 180
      : Math.min(180, distanciaKm / (111.320 * Math.abs(longitudScale)));

    const candidatos = await FaunaFlora.find({
      "ubicacion.latitud": { $gte: latitud - latitudDelta, $lte: latitud + latitudDelta },
      "ubicacion.longitud": { $gte: longitud - longitudDelta, $lte: longitud + longitudDelta }
    });

    const rad = Math.PI / 180;
    const cercanos = candidatos.filter((avistamiento) => {
      const deltaLat = (avistamiento.ubicacion.latitud - latitud) * rad;
      const deltaLon = (avistamiento.ubicacion.longitud - longitud) * rad;
      const haversine = Math.sin(deltaLat / 2) ** 2 +
        Math.cos(latitud * rad) *
        Math.cos(avistamiento.ubicacion.latitud * rad) *
        Math.sin(deltaLon / 2) ** 2;
      const distancia = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
      return distancia <= distanciaKm;
    });

    return res.status(200).json({ data: cercanos });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al buscar avistamientos cercanos");
  }
};

export const getAvistamientosPorEspecie = async (req, res) => {
  try {
    const avistamientos = await FaunaFlora.find({ especie: req.params.especie });
    return res.status(200).json({ data: avistamientos });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al buscar avistamientos por especie");
  }
};

export const getAvistamientosPorUsuario = async (req, res) => {
  try {
    const avistamientos = await FaunaFlora.find({ nombre_usuario: req.params.nombreUsuario });
    return res.status(200).json({ data: avistamientos });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al buscar avistamientos por usuario");
  }
};

export const updateAvistamiento = async (req, res) => {
  try {
    const avistamiento = await FaunaFlora.findById(req.params.id);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    const isAdmin = req.user.rol?.nombre_rol === "Administrador";
    if (!isAdmin && avistamiento.id_usuario?.toString() !== req.user._id.toString()) {
      return respondWithError(res, 403, "SIGHTING_UPDATE_FORBIDDEN", "No tienes permisos para este avistamiento");
    }

    const allowedFields = [
      "nombre_comun", "nombre_cientifico", "especie", "descripcion", "imagen",
      "ubicacion", "comportamiento", "estado_extincion", "estado_especimen", "tipo", "habitat"
    ];
    for (const field of allowedFields) {
      if (Object.hasOwn(req.body, field)) avistamiento[field] = req.body[field];
    }

    await avistamiento.save();
    return res.status(200).json({ data: avistamiento });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al actualizar el avistamiento");
  }
};

// Feed consolidado: Avistamientos de los usuarios a los que sigo
export const getFeedAvistamientos = async (req, res) => {
  try {
    const currentUserId = req.user?._id?.toString() || req.query.usuarioId || req.query.id_usuario;

    if (!currentUserId) {
      return respondWithError(res, 400, "USER_ID_REQUIRED", "Se requiere usuarioId o autenticación para obtener el feed");
    }

    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return respondWithError(res, 400, "INVALID_USER_ID", "ID de usuario inválido");
    }

    const usuario = await Usuario.findById(currentUserId);
    if (!usuario) {
      return respondWithError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    if (!usuario.seguidos || usuario.seguidos.length === 0) {
      return res.status(200).json({
        message: "Aún no sigues a ningún usuario. Sigue a otros exploradores para ver sus avistamientos aquí.",
        feed: [],
        total: 0
      });
    }

    const avistamientos = await FaunaFlora.find({
      id_usuario: { $in: usuario.seguidos }
    })
      .sort({ createdAt: -1 })
      .populate("id_usuario", "nombre_usuario imagen_perfil");

    const feed = avistamientos.map((item) => {
      const obj = item.toObject();
      obj.total_likes = item.likes ? item.likes.length : 0;
      obj.total_comentarios = item.comentarios ? item.comentarios.length : 0;
      obj.user_has_liked = item.likes
        ? item.likes.some((l) => l.toString() === currentUserId.toString())
        : false;
      return obj;
    });

    res.status(200).json({
      message: "Feed obtenido exitosamente",
      feed,
      total: feed.length
    });
  } catch (error) {
    console.error("❌ Error al obtener feed de avistamientos:", error);
    return respondWithControllerError(res, error, "Error al obtener el feed");
  }
};

// Alternar "like" en un avistamiento (dar y quitar sin duplicar)
export const toggleLikeAvistamiento = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id?.toString() || req.body.id_usuario || req.body.usuarioId;

    if (!userId) {
      return respondWithError(res, 400, "USER_ID_REQUIRED", "Se requiere autenticación o id_usuario para dar o quitar like");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return respondWithError(res, 400, "INVALID_USER_ID", "ID de usuario inválido");
    }

    const avistamiento = await FaunaFlora.findById(id);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    if (!avistamiento.likes) {
      avistamiento.likes = [];
    }

    const yaDioLike = avistamiento.likes.some(
      (likeId) => likeId.toString() === userId.toString()
    );

    if (yaDioLike) {
      avistamiento.likes = avistamiento.likes.filter(
        (likeId) => likeId.toString() !== userId.toString()
      );
    } else {
      avistamiento.likes.push(userId);
    }

    await avistamiento.save();

    res.status(200).json({
      message: yaDioLike ? "Like removido" : "Like agregado exitosamente",
      liked: !yaDioLike,
      total_likes: avistamiento.likes.length,
      avistamientoId: avistamiento._id
    });
  } catch (error) {
    console.error("❌ Error al alternar like:", error);
    return respondWithControllerError(res, error, "Error al procesar el like");
  }
};

// Agregar comentario (asociado a avistamiento y autor con fecha/hora)
export const addComentario = async (req, res) => {
  try {
    const { comentario } = req.body;
    
    if (!comentario || comentario.trim() === "") {
      return respondWithError(res, 400, "COMMENT_FIELDS_REQUIRED", "El comentario es requerido");
    }

    const avistamiento = await FaunaFlora.findById(req.params.id);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    const autorId = req.user?._id || req.body.id_usuario;
    const autorNombre = req.user?.nombre_usuario || req.body.nombre_usuario;
    const autorAvatar = req.user?.imagen_perfil || req.body.imagen_perfil || "";

    if (!autorNombre) {
      return respondWithError(res, 400, "AUTHOR_REQUIRED", "Se requiere usuario autenticado o nombre_usuario");
    }

    const nuevoComentario = {
      id_usuario: autorId,
      nombre_usuario: autorNombre,
      imagen_perfil: autorAvatar,
      comentario: comentario.trim(),
      fecha: new Date()
    };

    avistamiento.comentarios.push(nuevoComentario);
    await avistamiento.save();
    
    const comentarioCreado = avistamiento.comentarios[avistamiento.comentarios.length - 1];

    res.status(201).json({
      message: "Comentario agregado exitosamente",
      comentario: comentarioCreado,
      total_comentarios: avistamiento.comentarios.length,
      avistamientoId: avistamiento._id,
      data: avistamiento
    });
  } catch (error) {
    console.error("❌ Error al agregar comentario:", error);
    return respondWithControllerError(res, error, "Error al agregar comentario");
  }
};

// Eliminar comentario con moderación (Autor o Administrador)
export const deleteComentario = async (req, res) => {
  try {
    const { id, comentarioId } = req.params;
    const solicitanteId = req.user?._id?.toString() || req.body.id_usuario || req.query.id_usuario;

    if (!solicitanteId) {
      return respondWithError(res, 401, "AUTHENTICATION_REQUIRED", "Se requiere autenticación para eliminar un comentario");
    }

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(comentarioId)) {
      return respondWithError(res, 400, "INVALID_ID", "ID de avistamiento o comentario inválido");
    }

    const avistamiento = await FaunaFlora.findById(id);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    const comentario = avistamiento.comentarios.id(comentarioId);
    if (!comentario) {
      return respondWithError(res, 404, "COMMENT_NOT_FOUND", "Comentario no encontrado");
    }

    const esAutor = comentario.id_usuario && comentario.id_usuario.toString() === solicitanteId.toString();
    const esAdmin = req.user?.rol?.nombre_rol === "Administrador";

    if (!esAutor && !esAdmin) {
      return respondWithError(
        res,
        403,
        "COMMENT_DELETE_FORBIDDEN",
        "No tienes permisos para eliminar este comentario. Solo el autor o un Administrador pueden eliminarlo."
      );
    }

    avistamiento.comentarios.pull({ _id: comentarioId });
    await avistamiento.save();

    res.status(200).json({
      message: esAdmin && !esAutor
        ? "Comentario eliminado por un Administrador (moderación)"
        : "Comentario eliminado exitosamente",
      comentarioId,
      total_comentarios: avistamiento.comentarios.length,
      avistamientoId: avistamiento._id
    });
  } catch (error) {
    console.error("❌ Error al eliminar comentario:", error);
    return respondWithControllerError(res, error, "Error al eliminar comentario");
  }
};

export const deleteAvistamiento = async (req, res) => {
  try {
    const avistamiento = await FaunaFlora.findById(req.params.id);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    const isAdmin = req.user.rol?.nombre_rol === "Administrador";
    if (!isAdmin && avistamiento.id_usuario?.toString() !== req.user._id.toString()) {
      return respondWithError(res, 403, "SIGHTING_DELETE_FORBIDDEN", "No tienes permisos para este avistamiento");
    }

    await avistamiento.deleteOne();
    res.status(200).json({ message: "Avistamiento eliminado correctamente" });
  } catch (error) {
    console.error('❌ Error al eliminar avistamiento:', error);
    return respondWithControllerError(res, error, "Error al eliminar avistamiento");
  }
};

export const getFrequentZones = async (req, res) => {
  try {
    const frequentZones = await FaunaFlora.aggregate([
      {
        $group: {
          _id: { lat: "$ubicacion.latitud", lng: "$ubicacion.longitud", especie: "$especie" },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $project: {
          lat: "$_id.lat",
          lng: "$_id.lng",
          especie: "$_id.especie",
          count: 1,
          _id: 0
        }
      }
    ]);
    res.status(200).json(frequentZones);
  } catch (error) {
    console.error('❌ Error al obtener zonas frecuentes:', error);
    return respondWithControllerError(res, error, "Error al obtener zonas frecuentes");
  }
};

// Votar por comunidad
export const votarValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const id_usuario = req.user._id.toString();

    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    if (avistamiento.id_usuario && avistamiento.id_usuario.toString() === id_usuario) {
      return respondWithError(res, 403, "SELF_VOTE_FORBIDDEN", "No puedes votar tu propio avistamiento");
    }

    if (avistamiento.validacion.usuarios_validadores.includes(id_usuario)) {
      return respondWithError(res, 409, "ALREADY_VOTED", "Este usuario ya validó este avistamiento");
    }

    avistamiento.validacion.usuarios_validadores.push(id_usuario);
    avistamiento.validacion.votos_comunidad += 1;

    if (avistamiento.validacion.votos_comunidad >= avistamiento.validacion.requeridos_comunidad) {
      avistamiento.validacion.estado = "validado_comunidad";
    }

    await avistamiento.save();

    res.status(200).json({
      message: "Voto registrado correctamente",
      estado_actual: avistamiento.validacion.estado,
      votos_comunidad: avistamiento.validacion.votos_comunidad,
    });

  } catch (error) {
    console.error('❌ Error al registrar voto:', error);
    return respondWithControllerError(res, error, "Error al registrar el voto");
  }
};

// Validación por experto
export const validarPorExperto = async (req, res) => {
  try {
    const avistamientoId = req.params.id;

    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    avistamiento.validacion.validado_por_experto = true;
    avistamiento.validacion.estado = "validado_experto";

    await avistamiento.save();

    res.status(200).json({
      message: "Avistamiento validado por experto",
      estado_actual: avistamiento.validacion.estado,
    });

  } catch (error) {
    console.error('❌ Error al validar por experto:', error);
    return respondWithControllerError(res, error, "Error al validar por experto");
  }
};

export const obtenerEstadoValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const userId = req.user._id.toString();

    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    const validacion = avistamiento.validacion;
    const yaVoto = validacion.usuarios_validadores?.includes(userId) ?? false;

    res.status(200).json({
      estado: validacion.estado,
      votos_comunidad: validacion.votos_comunidad,
      requeridos_comunidad: validacion.requeridos_comunidad,
      validado_por_experto: validacion.validado_por_experto,
      usuarios_validadores: validacion.usuarios_validadores,
      yaVoto,
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return respondWithControllerError(res, error, "Error al obtener estado");
  }
};
