import prisma from '../config/db.js';
import { distanceInMeters } from '../utils/geo.js';

export const AVISTAMIENTO_RECOMMENDATION_RADIUS_METERS = 1_000;
export const AVISTAMIENTO_RECOMMENDATION_LIMIT = 5;

export function validateFaunaFloraInput(data = {}) {
  const {
    nombre_comun,
    nombre_cientifico,
    especie,
    habitat,
    ubicacion,
    tipo,
    validacion,
    id_usuario,
    es_peligrosa,
  } = data;

  if (!habitat || !habitat.id_habitat) {
    throw new Error('Habitat es requerido y debe tener un id_habitat');
  }

  if (!nombre_comun || !nombre_cientifico || !especie || !tipo) {
    throw new Error('Nombre común, nombre científico, especie y tipo son requeridos');
  }

  if (
    !ubicacion ||
    typeof ubicacion.latitud !== 'number' ||
    typeof ubicacion.longitud !== 'number'
  ) {
    throw new Error('Ubicación es requerida con latitud y longitud válidas');
  }

  return {
    ...data,
    nombre_comun: nombre_comun.trim(),
    nombre_cientifico: nombre_cientifico.trim(),
    especie: especie.trim(),
    tipo: tipo.trim(),
    id_usuario: id_usuario || null,
    es_peligrosa: !!es_peligrosa,
    ubicacion: {
      latitud: Number(ubicacion.latitud),
      longitud: Number(ubicacion.longitud),
    },
    validacion: {
      estado: validacion?.estado || 'pendiente',
      votos_comunidad: validacion?.votos_comunidad ?? 0,
      requeridos_comunidad: validacion?.requeridos_comunidad ?? 5,
      validado_por_experto: !!validacion?.validado_por_experto,
    },
  };
}

export function buildFaunaFloraFilter({ especie, categoria, buscar, cursor }) {
  const filter = {};

  if (especie) {
    filter.especie = especie;
  }

  if (categoria) {
    filter.especie = categoria;
  }

  if (typeof buscar === 'string' && buscar.trim()) {
    const searchTerm = buscar.trim().slice(0, 100);
    filter.OR = [
      { nombre_comun: { contains: searchTerm, mode: 'insensitive' } },
      { nombre_cientifico: { contains: searchTerm, mode: 'insensitive' } },
      { especie: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  if (cursor) {
    filter.id = { lt: cursor };
  }

  return filter;
}

export function formatAvistamientoMetrics(item, currentUserId) {
  return {
    ...item,
    total_likes: item.likes ? item.likes.length : 0,
    total_comentarios: item.comentarios ? item.comentarios.length : 0,
    user_has_liked: currentUserId && item.likes ? item.likes.includes(currentUserId) : false,
  };
}

export async function listFaunaFloraService({ filter, limit = 100, currentUserId }) {
  const records = await prisma.faunaFlora.findMany({
    where: filter,
    orderBy: { id: 'desc' },
    take: limit + 1,
    include: {
      usuario: {
        select: { nombre_usuario: true, imagen_perfil: true },
      },
    },
  });

  return records.map((item) => formatAvistamientoMetrics(item, currentUserId));
}

export function selectAvistamientoRecommendations(
  origin,
  candidates,
  radiusMeters = AVISTAMIENTO_RECOMMENDATION_RADIUS_METERS,
  limit = AVISTAMIENTO_RECOMMENDATION_LIMIT,
) {
  const eligibleCandidates = candidates.filter(({ id }) => id !== origin.id);
  const nearby = eligibleCandidates
    .map((avistamiento) => ({
      id: avistamiento.id,
      distanceMeters: distanceInMeters(
        origin.ubicacion?.latitud,
        origin.ubicacion?.longitud,
        avistamiento.ubicacion?.latitud,
        avistamiento.ubicacion?.longitud,
      ),
    }))
    .filter(({ distanceMeters }) => distanceMeters <= radiusMeters)
    .sort((first, second) => first.distanceMeters - second.distanceMeters)
    .slice(0, limit);

  if (nearby.length > 0) {
    return { criterio: 'cercania', recomendaciones: nearby };
  }

  const sameSpecies = eligibleCandidates
    .filter(({ especie }) => especie === origin.especie)
    .slice(0, limit)
    .map(({ id }) => ({ id, distanceMeters: null }));

  return { criterio: 'especie', recomendaciones: sameSpecies };
}

export async function getAvistamientoRecommendationsService({ avistamientoId }) {
  const origin = await prisma.faunaFlora.findUnique({
    where: { id: avistamientoId },
    select: { id: true, especie: true, ubicacion: true },
  });

  if (!origin) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const candidates = await prisma.faunaFlora.findMany({
    where: { id: { not: avistamientoId } },
    orderBy: { id: 'desc' },
    select: { id: true, especie: true, ubicacion: true },
  });
  const selection = selectAvistamientoRecommendations(origin, candidates);

  if (selection.recomendaciones.length === 0) {
    return {
      criterio: selection.criterio,
      radio_metros: AVISTAMIENTO_RECOMMENDATION_RADIUS_METERS,
      recomendaciones: [],
    };
  }

  const records = await prisma.faunaFlora.findMany({
    where: { id: { in: selection.recomendaciones.map(({ id }) => id) } },
    include: {
      usuario: { select: { nombre_usuario: true, imagen_perfil: true } },
    },
  });
  const recordsById = new Map(records.map((record) => [record.id, record]));

  return {
    criterio: selection.criterio,
    radio_metros: AVISTAMIENTO_RECOMMENDATION_RADIUS_METERS,
    recomendaciones: selection.recomendaciones.flatMap(({ id, distanceMeters }) => {
      const record = recordsById.get(id);
      if (!record) return [];

      return [{
        ...formatAvistamientoMetrics(record),
        distancia_metros: distanceMeters === null ? null : Math.round(distanceMeters),
      }];
    }),
  };
}

export async function createFaunaFloraService(input) {
  const normalized = validateFaunaFloraInput(input);

  const habitatExiste = await prisma.habitat.findUnique({
    where: { id: normalized.habitat.id_habitat },
  });

  if (!habitatExiste) {
    const error = new Error('Habitat no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return prisma.faunaFlora.create({
    data: {
      nombre_comun: normalized.nombre_comun,
      nombre_cientifico: normalized.nombre_cientifico,
      especie: normalized.especie,
      descripcion: normalized.descripcion,
      imagen: normalized.imagen,
      ubicacion: {
        latitud: normalized.ubicacion.latitud,
        longitud: normalized.ubicacion.longitud,
      },
      comportamiento: normalized.comportamiento,
      estado_extincion: normalized.estado_extincion,
      estado_especimen: normalized.estado_especimen,
      habitat: {
        set: {
          id_habitat: normalized.habitat.id_habitat,
          nombre_habitat: normalized.habitat.nombre_habitat || habitatExiste.nombre_habitat,
          descripcion_habitat: normalized.habitat.descripcion_habitat || habitatExiste.descripcion_habitat,
        },
      },
      tipo: normalized.tipo,
      nombre_usuario: normalized.nombre_usuario,
      id_usuario: normalized.id_usuario || null,
      es_peligrosa: normalized.es_peligrosa || false,
      validacion: {
        set: normalized.validacion,
      },
    },
  });
}

export async function getAvistamientoByIdService({ id, currentUserId }) {
  const avistamiento = await prisma.faunaFlora.findUnique({
    where: { id },
    include: {
      usuario: {
        select: { nombre_usuario: true, imagen_perfil: true },
      },
    },
  });

  if (!avistamiento) {
    return null;
  }

  return formatAvistamientoMetrics(avistamiento, currentUserId);
}

export function buildComentarioPayload({ comentario, autorId, autorNombre, autorAvatar }) {
  if (!comentario || comentario.trim() === '') {
    throw new Error('El comentario es requerido');
  }

  if (!autorNombre) {
    throw new Error('Se requiere usuario autenticado o nombre_usuario');
  }

  let validIdUsuario = null;
  if (autorId && autorId !== 'null' && autorId !== '000000000000000000000000') {
    const idString = String(autorId);
    if (/^[0-9a-fA-F]{24}$/.test(idString)) {
      validIdUsuario = idString;
    }
  }

  return {
    id_usuario: validIdUsuario,
    nombre_usuario: autorNombre,
    imagen_perfil: autorAvatar || '',
    comentario: comentario.trim(),
    fecha: new Date(),
  };
}

export async function addComentarioService({ avistamientoId, comentario, autorId, autorNombre, autorAvatar }) {
  const avistamiento = await prisma.faunaFlora.findUnique({ where: { id: avistamientoId } });

  if (!avistamiento) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const nuevoComentario = buildComentarioPayload({
    comentario,
    autorId,
    autorNombre,
    autorAvatar,
  });

  const updatedAvistamiento = await prisma.faunaFlora.update({
    where: { id: avistamientoId },
    data: {
      comentarios: {
        push: nuevoComentario,
      },
    },
  });

  const comentarioCreado = updatedAvistamiento.comentarios[updatedAvistamiento.comentarios.length - 1];

  return {
    avistamiento,
    comentarioCreado,
    updatedAvistamiento,
  };
}

export async function toggleLikeAvistamientoService({ id, userId }) {
  if (!userId) {
    throw new Error('Se requiere autenticación o id_usuario para dar o quitar like');
  }

  const avistamiento = await prisma.faunaFlora.findUnique({ where: { id } });
  if (!avistamiento) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const likes = avistamiento.likes || [];
  const normalizedUserId = String(userId);
  const yaDioLike = likes.includes(normalizedUserId);

  const updatedLikes = yaDioLike
    ? likes.filter((likeId) => likeId !== normalizedUserId)
    : [...likes, normalizedUserId];

  const updatedAvistamiento = await prisma.faunaFlora.update({
    where: { id },
    data: { likes: updatedLikes },
  });

  return {
    avistamiento,
    updatedAvistamiento,
    yaDioLike,
    liked: !yaDioLike,
  };
}

export async function deleteComentarioService({ id, comentarioId, solicitanteId, rol }) {
  const avistamiento = await prisma.faunaFlora.findUnique({ where: { id } });
  if (!avistamiento) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const comentario = avistamiento.comentarios.find((item) => item.id === comentarioId);
  if (!comentario) {
    const error = new Error('Comentario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const esAutor = comentario.id_usuario === solicitanteId;
  const esAdmin = rol === 'Administrador';

  if (!esAutor && !esAdmin) {
    const error = new Error('No tienes permisos para eliminar este comentario. Solo el autor o un Administrador pueden eliminarlo.');
    error.statusCode = 403;
    throw error;
  }

  const updatedComentarios = avistamiento.comentarios.filter((item) => item.id !== comentarioId);
  const updatedAvistamiento = await prisma.faunaFlora.update({
    where: { id },
    data: { comentarios: updatedComentarios },
  });

  return {
    comentario,
    updatedAvistamiento,
    esAutor,
    esAdmin,
  };
}

export async function votarValidacionService({ avistamientoId, userId }) {
  const avistamiento = await prisma.faunaFlora.findUnique({ where: { id: avistamientoId } });

  if (!avistamiento) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (avistamiento.id_usuario && String(avistamiento.id_usuario) === String(userId)) {
    const error = new Error('No puedes votar tu propio avistamiento');
    error.statusCode = 403;
    throw error;
  }

  const validadores = avistamiento.usuarios_validadores_ids || [];
  if (validadores.some((v) => String(v) === String(userId))) {
    const error = new Error('Este usuario ya validó este avistamiento');
    error.statusCode = 400;
    throw error;
  }

  const nuevosVotos = (avistamiento.validacion?.votos_comunidad || 0) + 1;
  let nuevoEstado = avistamiento.validacion?.estado || 'pendiente';

  if (nuevosVotos >= (avistamiento.validacion?.requeridos_comunidad || 5)) {
    nuevoEstado = 'validado_comunidad';
  }

  const updatedAvistamiento = await prisma.faunaFlora.update({
    where: { id: avistamientoId },
    data: {
      usuarios_validadores_ids: {
        push: userId,
      },
      validacion: {
        estado: nuevoEstado,
        votos_comunidad: nuevosVotos,
        requeridos_comunidad: avistamiento.validacion?.requeridos_comunidad || 5,
        validado_por_experto: avistamiento.validacion?.validado_por_experto || false,
      },
    },
  });

  return updatedAvistamiento;
}

export async function validarPorExpertoService({ avistamientoId, userId, rol }) {
  if (!userId || !rol) {
    throw new Error('Se requiere id_usuario y rol');
  }

  if (!['Investigador', 'Administrador'].includes(rol)) {
    const error = new Error('Usuario no autorizado para validar como experto');
    error.statusCode = 403;
    throw error;
  }

  const avistamiento = await prisma.faunaFlora.findUnique({ where: { id: avistamientoId } });
  if (!avistamiento) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const updatedAvistamiento = await prisma.faunaFlora.update({
    where: { id: avistamientoId },
    data: {
      validacion: {
        estado: 'validado_experto',
        votos_comunidad: avistamiento.validacion?.votos_comunidad || 0,
        requeridos_comunidad: avistamiento.validacion?.requeridos_comunidad || 5,
        validado_por_experto: true,
      },
    },
  });

  return updatedAvistamiento;
}

export async function obtenerEstadoValidacionService({ avistamientoId, userId }) {
  const avistamiento = await prisma.faunaFlora.findUnique({ where: { id: avistamientoId } });

  if (!avistamiento) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const validacion = avistamiento.validacion;
  const yaVoto = avistamiento.usuarios_validadores_ids?.some((v) => String(v) === String(userId)) ?? false;

  return {
    estado: validacion?.estado || 'pendiente',
    votos_comunidad: validacion?.votos_comunidad || 0,
    requeridos_comunidad: validacion?.requeridos_comunidad || 5,
    validado_por_experto: validacion?.validado_por_experto || false,
    usuarios_validadores: avistamiento.usuarios_validadores_ids || [],
    yaVoto,
  };
}

export async function getFeedAvistamientosService({ currentUserId, cursor, limit = 100 }) {
  if (!currentUserId) {
    const error = new Error('Se requiere usuarioId o autenticación para obtener el feed');
    error.statusCode = 400;
    throw error;
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: currentUserId } });

  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (!usuario.seguidos || usuario.seguidos.length === 0) {
    return {
      usuario,
      avistamientos: [],
      emptyFeed: true,
    };
  }

  const avistamientos = await prisma.faunaFlora.findMany({
    where: {
      id_usuario: { in: usuario.seguidos },
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: 'desc' },
    take: limit + 1,
    include: {
      usuario: {
        select: { nombre_usuario: true, imagen_perfil: true },
      },
    },
  });

  return { usuario, avistamientos, emptyFeed: false };
}

export async function deleteAvistamientoService({ id }) {
  return prisma.faunaFlora.delete({ where: { id } });
}
