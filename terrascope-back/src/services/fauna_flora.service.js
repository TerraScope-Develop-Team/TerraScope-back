import prisma from '../config/db.js';

const DEFAULT_VOTING_PERIOD_HOURS = 24;

export function getVotingPeriodMs() {
  const minutes = Number(process.env.VOTING_PERIOD_MINUTES);
  if (Number.isFinite(minutes) && minutes > 0) {
    return minutes * 60 * 1000;
  }

  const hours = Number(process.env.VOTING_PERIOD_HOURS);
  if (Number.isFinite(hours) && hours > 0) {
    return hours * 60 * 60 * 1000;
  }

  return DEFAULT_VOTING_PERIOD_HOURS * 60 * 60 * 1000;
}

export function normalizeTipoVoto(tipoVoto) {
  if (tipoVoto === undefined || tipoVoto === null || tipoVoto === '') {
    return 'positivo';
  }

  if (typeof tipoVoto === 'boolean') {
    return tipoVoto ? 'positivo' : 'negativo';
  }

  if (typeof tipoVoto === 'number') {
    if (tipoVoto > 0) return 'positivo';
    if (tipoVoto <= 0) return 'negativo';
  }

  const normalized = String(tipoVoto).trim().toLowerCase();
  if (['positivo', 'pos', 'up', 'a_favor', 'favor', 'true', '1', '+1'].includes(normalized)) {
    return 'positivo';
  }
  if (['negativo', 'neg', 'down', 'en_contra', 'contra', 'false', '0', '-1'].includes(normalized)) {
    return 'negativo';
  }

  const error = new Error('El tipo de voto debe ser "positivo" o "negativo"');
  error.statusCode = 400;
  throw error;
}

export function extractValidacionSummary(avistamiento) {
  const validacion = avistamiento?.validacion || {};
  const rawPositivos = validacion.votos_positivos ?? 0;
  const rawNegativos = validacion.votos_negativos ?? 0;
  const rawComunidad = validacion.votos_comunidad ?? 0;

  const votosPositivos =
    rawPositivos > 0 || rawNegativos > 0 ? rawPositivos : rawComunidad;
  const votosNegativos = rawNegativos;
  const requeridosComunidad = validacion.requeridos_comunidad ?? 5;
  const validadoPorExperto = !!validacion.validado_por_experto;
  const estado = validacion.estado || 'pendiente';

  const validadoresGenerales = Array.isArray(avistamiento?.usuarios_validadores_ids)
    ? avistamiento.usuarios_validadores_ids.map(String)
    : [];

  const usuariosPositivos = Array.isArray(validacion.usuarios_positivos) && validacion.usuarios_positivos.length > 0
    ? validacion.usuarios_positivos.map(String)
    : rawNegativos === 0 && validadoresGenerales.length > 0
      ? [...validadoresGenerales]
      : [];

  const usuariosNegativos = Array.isArray(validacion.usuarios_negativos)
    ? validacion.usuarios_negativos.map(String)
    : [];

  const todosVotantes = Array.from(
    new Set([...validadoresGenerales, ...usuariosPositivos, ...usuariosNegativos])
  );

  const fechaInicio = validacion.fecha_inicio_votacion
    ? new Date(validacion.fecha_inicio_votacion)
    : avistamiento?.createdAt
      ? new Date(avistamiento.createdAt)
      : null;

  const fechaFin = validacion.fecha_fin_votacion
    ? new Date(validacion.fecha_fin_votacion)
    : fechaInicio
      ? new Date(fechaInicio.getTime() + getVotingPeriodMs())
      : null;

  return {
    estado,
    votosPositivos,
    votosNegativos,
    requeridosComunidad,
    validadoPorExperto,
    usuariosPositivos,
    usuariosNegativos,
    todosVotantes,
    fechaInicio,
    fechaFin,
  };
}

export function evaluarResolucionVotacion(avistamiento, now = new Date()) {
  const summary = extractValidacionSummary(avistamiento);

  if (
    summary.validadoPorExperto ||
    summary.estado === 'validado_experto' ||
    summary.estado === 'validado_comunidad'
  ) {
    return {
      accion: 'ninguna',
      motivo: null,
      estado: summary.estado,
      votos_positivos: summary.votosPositivos,
      votos_negativos: summary.votosNegativos,
    };
  }

  // 1. Si llega al umbral requerido con mayoría de votos negativos, se elimina de inmediato
  if (
    summary.votosNegativos >= summary.requeridosComunidad &&
    summary.votosNegativos > summary.votosPositivos
  ) {
    return {
      accion: 'eliminar',
      motivo: 'mayoria_negativa',
      estado: 'eliminado',
      votos_positivos: summary.votosPositivos,
      votos_negativos: summary.votosNegativos,
    };
  }

  // 2. Si el periodo de votación ha concluido, se evalúa el resultado por mayoría o inactividad
  if (summary.fechaFin && now.getTime() >= summary.fechaFin.getTime()) {
    if (summary.votosPositivos === 0 && summary.votosNegativos === 0) {
      return {
        accion: 'eliminar',
        motivo: 'sin_votos',
        estado: 'eliminado',
        votos_positivos: 0,
        votos_negativos: 0,
      };
    }

    if (summary.votosNegativos >= summary.votosPositivos) {
      return {
        accion: 'eliminar',
        motivo:
          summary.votosNegativos > summary.votosPositivos
            ? 'mayoria_negativa'
            : 'empate_sin_mayoria_positiva',
        estado: 'eliminado',
        votos_positivos: summary.votosPositivos,
        votos_negativos: summary.votosNegativos,
      };
    }

    return {
      accion: 'validar_comunidad',
      motivo: 'mayoria_positiva',
      estado: 'validado_comunidad',
      votos_positivos: summary.votosPositivos,
      votos_negativos: summary.votosNegativos,
    };
  }

  return {
    accion: 'ninguna',
    motivo: null,
    estado: summary.estado,
    votos_positivos: summary.votosPositivos,
    votos_negativos: summary.votosNegativos,
  };
}

export async function aplicarResolucionVotacionService(avistamiento, now = new Date()) {
  const evaluacion = evaluarResolucionVotacion(avistamiento, now);
  const summary = extractValidacionSummary(avistamiento);

  if (evaluacion.accion === 'eliminar') {
    await prisma.faunaFlora.delete({ where: { id: avistamiento.id } });
    return {
      eliminado: true,
      motivo: evaluacion.motivo,
      estado_actual: 'eliminado',
      votos_positivos: evaluacion.votos_positivos,
      votos_negativos: evaluacion.votos_negativos,
      avistamiento: null,
    };
  }

  if (evaluacion.accion === 'validar_comunidad') {
    const updated = await prisma.faunaFlora.update({
      where: { id: avistamiento.id },
      data: {
        validacion: {
          estado: 'validado_comunidad',
          votos_comunidad: summary.votosPositivos,
          votos_positivos: summary.votosPositivos,
          votos_negativos: summary.votosNegativos,
          requeridos_comunidad: summary.requeridosComunidad,
          validado_por_experto: summary.validadoPorExperto,
          usuarios_positivos: summary.usuariosPositivos,
          usuarios_negativos: summary.usuariosNegativos,
          fecha_inicio_votacion: summary.fechaInicio,
          fecha_fin_votacion: summary.fechaFin,
        },
      },
    });

    return {
      eliminado: false,
      motivo: evaluacion.motivo,
      estado_actual: 'validado_comunidad',
      votos_positivos: summary.votosPositivos,
      votos_negativos: summary.votosNegativos,
      avistamiento: updated,
    };
  }

  return {
    eliminado: false,
    motivo: null,
    estado_actual: summary.estado,
    votos_positivos: summary.votosPositivos,
    votos_negativos: summary.votosNegativos,
    avistamiento,
  };
}

export async function procesarVotacionesVencidasService(now = new Date()) {
  const pendientes = await prisma.faunaFlora.findMany({
    where: {
      validacion: {
        is: {
          estado: 'pendiente',
        },
      },
    },
  });

  let eliminados = 0;
  let validados = 0;

  for (const item of pendientes) {
    const evaluacion = evaluarResolucionVotacion(item, now);
    if (evaluacion.accion === 'ninguna') continue;

    try {
      const resultado = await aplicarResolucionVotacionService(item, now);
      if (resultado.eliminado) {
        eliminados += 1;
      } else if (resultado.estado_actual === 'validado_comunidad') {
        validados += 1;
      }
    } catch (err) {
      // Ignorar si ya fue eliminado concurrentemente
      if (err?.code !== 'P2025') {
        console.error(`Error procesando votación vencida para ${item.id}:`, err);
      }
    }
  }

  return {
    eliminados,
    validados,
    totalEvaluados: pendientes.length,
  };
}

export function validateFaunaFloraInput(data = {}, now = new Date()) {
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

  const votosPositivos = validacion?.votos_positivos ?? validacion?.votos_comunidad ?? 0;
  const votosNegativos = validacion?.votos_negativos ?? 0;
  const fechaInicio = validacion?.fecha_inicio_votacion
    ? new Date(validacion.fecha_inicio_votacion)
    : now;
  const fechaFin = validacion?.fecha_fin_votacion
    ? new Date(validacion.fecha_fin_votacion)
    : new Date(fechaInicio.getTime() + getVotingPeriodMs());

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
      votos_comunidad: votosPositivos,
      votos_positivos: votosPositivos,
      votos_negativos: votosNegativos,
      requeridos_comunidad: validacion?.requeridos_comunidad ?? 5,
      validado_por_experto: !!validacion?.validado_por_experto,
      usuarios_positivos: Array.isArray(validacion?.usuarios_positivos)
        ? validacion.usuarios_positivos.map(String)
        : [],
      usuarios_negativos: Array.isArray(validacion?.usuarios_negativos)
        ? validacion.usuarios_negativos.map(String)
        : [],
      fecha_inicio_votacion: fechaInicio,
      fecha_fin_votacion: fechaFin,
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
  await procesarVotacionesVencidasService();

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

export async function getAvistamientoByIdService({ id, currentUserId, now = new Date() }) {
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

  const resolucion = await aplicarResolucionVotacionService(avistamiento, now);
  if (resolucion.eliminado) {
    return null;
  }

  const target = resolucion.avistamiento || avistamiento;
  return formatAvistamientoMetrics(target, currentUserId);
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

export async function votarValidacionService({
  avistamientoId,
  userId,
  tipoVoto = 'positivo',
  now = new Date(),
}) {
  const avistamiento = await prisma.faunaFlora.findUnique({ where: { id: avistamientoId } });

  if (!avistamiento) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const summary = extractValidacionSummary(avistamiento);

  // Si ya venció el periodo de votación antes de emitir este voto, resolvemos por tiempo
  if (
    summary.estado === 'pendiente' &&
    !summary.validadoPorExperto &&
    summary.fechaFin &&
    now.getTime() >= summary.fechaFin.getTime()
  ) {
    const resolucion = await aplicarResolucionVotacionService(avistamiento, now);
    return {
      eliminado: resolucion.eliminado,
      vencido: true,
      motivo: resolucion.motivo,
      estado_actual: resolucion.estado_actual,
      votos_comunidad: resolucion.votos_positivos,
      votos_positivos: resolucion.votos_positivos,
      votos_negativos: resolucion.votos_negativos,
      requeridos_comunidad: summary.requeridosComunidad,
      validacion: resolucion.avistamiento?.validacion || {
        estado: resolucion.estado_actual,
        votos_comunidad: resolucion.votos_positivos,
        votos_positivos: resolucion.votos_positivos,
        votos_negativos: resolucion.votos_negativos,
        requeridos_comunidad: summary.requeridosComunidad,
        validado_por_experto: summary.validadoPorExperto,
      },
    };
  }

  if (summary.validadoPorExperto || summary.estado !== 'pendiente') {
    const error = new Error('La votación para este avistamiento ya ha finalizado');
    error.statusCode = 400;
    throw error;
  }

  if (avistamiento.id_usuario && String(avistamiento.id_usuario) === String(userId)) {
    const error = new Error('No puedes votar tu propio avistamiento');
    error.statusCode = 403;
    throw error;
  }

  const normalizedUserId = String(userId);
  if (summary.todosVotantes.includes(normalizedUserId)) {
    const error = new Error('Este usuario ya validó este avistamiento');
    error.statusCode = 400;
    throw error;
  }

  const tipoNormalizado = normalizeTipoVoto(tipoVoto);
  const esPositivo = tipoNormalizado === 'positivo';

  const nuevosPositivos = summary.votosPositivos + (esPositivo ? 1 : 0);
  const nuevosNegativos = summary.votosNegativos + (esPositivo ? 0 : 1);

  const nuevosUsuariosPositivos = esPositivo
    ? [...summary.usuariosPositivos, normalizedUserId]
    : [...summary.usuariosPositivos];
  const nuevosUsuariosNegativos = !esPositivo
    ? [...summary.usuariosNegativos, normalizedUserId]
    : [...summary.usuariosNegativos];

  const fechaInicio = summary.fechaInicio || now;
  const fechaFin = summary.fechaFin || new Date(fechaInicio.getTime() + getVotingPeriodMs());

  // Si al registrar un voto negativo se alcanza la mayoría de votos negativos (>= requeridos y > positivos), se elimina automáticamente
  if (
    nuevosNegativos >= summary.requeridosComunidad &&
    nuevosNegativos > nuevosPositivos
  ) {
    await prisma.faunaFlora.delete({ where: { id: avistamientoId } });
    return {
      id: avistamientoId,
      eliminado: true,
      vencido: false,
      motivo: 'mayoria_negativa',
      tipo_voto: tipoNormalizado,
      estado_actual: 'eliminado',
      votos_comunidad: nuevosPositivos,
      votos_positivos: nuevosPositivos,
      votos_negativos: nuevosNegativos,
      requeridos_comunidad: summary.requeridosComunidad,
      validacion: {
        estado: 'eliminado',
        votos_comunidad: nuevosPositivos,
        votos_positivos: nuevosPositivos,
        votos_negativos: nuevosNegativos,
        requeridos_comunidad: summary.requeridosComunidad,
        validado_por_experto: false,
        usuarios_positivos: nuevosUsuariosPositivos,
        usuarios_negativos: nuevosUsuariosNegativos,
        fecha_inicio_votacion: fechaInicio,
        fecha_fin_votacion: fechaFin,
      },
    };
  }

  // El estado se mantiene en 'pendiente' durante el periodo de tiempo para no premiar votos rápidos sobre la mayoría real
  const nuevoEstado = 'pendiente';

  const updatedAvistamiento = await prisma.faunaFlora.update({
    where: { id: avistamientoId },
    data: {
      usuarios_validadores_ids: {
        push: userId,
      },
      validacion: {
        estado: nuevoEstado,
        votos_comunidad: nuevosPositivos,
        votos_positivos: nuevosPositivos,
        votos_negativos: nuevosNegativos,
        requeridos_comunidad: summary.requeridosComunidad,
        validado_por_experto: summary.validadoPorExperto,
        usuarios_positivos: nuevosUsuariosPositivos,
        usuarios_negativos: nuevosUsuariosNegativos,
        fecha_inicio_votacion: fechaInicio,
        fecha_fin_votacion: fechaFin,
      },
    },
  });

  return {
    ...updatedAvistamiento,
    eliminado: false,
    vencido: false,
    motivo: null,
    tipo_voto: tipoNormalizado,
    estado_actual: updatedAvistamiento.validacion.estado,
    votos_comunidad: nuevosPositivos,
    votos_positivos: nuevosPositivos,
    votos_negativos: nuevosNegativos,
    requeridos_comunidad: summary.requeridosComunidad,
  };
}

export async function validarPorExpertoService({ avistamientoId, userId, rol }) {
  if (!userId || !rol) {
    throw new Error('Se requiere id_usuario y rol');
  }

  if (!['Investigador', 'Experto', 'Administrador'].includes(rol)) {
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

  const summary = extractValidacionSummary(avistamiento);

  const updatedAvistamiento = await prisma.faunaFlora.update({
    where: { id: avistamientoId },
    data: {
      validacion: {
        estado: 'validado_experto',
        votos_comunidad: summary.votosPositivos,
        votos_positivos: summary.votosPositivos,
        votos_negativos: summary.votosNegativos,
        requeridos_comunidad: summary.requeridosComunidad,
        validado_por_experto: true,
        usuarios_positivos: summary.usuariosPositivos,
        usuarios_negativos: summary.usuariosNegativos,
        fecha_inicio_votacion: summary.fechaInicio,
        fecha_fin_votacion: summary.fechaFin,
      },
    },
  });

  return updatedAvistamiento;
}

export async function obtenerEstadoValidacionService({ avistamientoId, userId, now = new Date() }) {
  const avistamiento = await prisma.faunaFlora.findUnique({ where: { id: avistamientoId } });

  if (!avistamiento) {
    const error = new Error('Avistamiento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const resolucion = await aplicarResolucionVotacionService(avistamiento, now);
  if (resolucion.eliminado) {
    return {
      estado: 'eliminado',
      eliminado: true,
      motivo: resolucion.motivo,
      votos_comunidad: resolucion.votos_positivos,
      votos_positivos: resolucion.votos_positivos,
      votos_negativos: resolucion.votos_negativos,
      requeridos_comunidad: avistamiento.validacion?.requeridos_comunidad || 5,
      validado_por_experto: false,
      usuarios_validadores: [],
      usuarios_positivos: [],
      usuarios_negativos: [],
      yaVoto: false,
      tipo_voto_usuario: null,
      fecha_inicio_votacion: avistamiento.validacion?.fecha_inicio_votacion || null,
      fecha_fin_votacion: avistamiento.validacion?.fecha_fin_votacion || null,
    };
  }

  const target = resolucion.avistamiento || avistamiento;
  const summary = extractValidacionSummary(target);
  const normalizedUserId = userId ? String(userId) : '';

  const votoPositivo = normalizedUserId ? summary.usuariosPositivos.includes(normalizedUserId) : false;
  const votoNegativo = normalizedUserId ? summary.usuariosNegativos.includes(normalizedUserId) : false;
  const yaVoto = normalizedUserId ? summary.todosVotantes.includes(normalizedUserId) : false;

  let tipoVotoUsuario = null;
  if (votoPositivo) tipoVotoUsuario = 'positivo';
  else if (votoNegativo) tipoVotoUsuario = 'negativo';
  else if (yaVoto) tipoVotoUsuario = 'positivo';

  return {
    estado: summary.estado,
    eliminado: false,
    motivo: resolucion.motivo,
    votos_comunidad: summary.votosPositivos,
    votos_positivos: summary.votosPositivos,
    votos_negativos: summary.votosNegativos,
    requeridos_comunidad: summary.requeridosComunidad,
    validado_por_experto: summary.validadoPorExperto,
    usuarios_validadores: summary.todosVotantes,
    usuarios_positivos: summary.usuariosPositivos,
    usuarios_negativos: summary.usuariosNegativos,
    yaVoto,
    tipo_voto_usuario: tipoVotoUsuario,
    fecha_inicio_votacion: summary.fechaInicio,
    fecha_fin_votacion: summary.fechaFin,
  };
}

export async function getFeedAvistamientosService({ currentUserId, cursor, limit = 100 }) {
  if (!currentUserId) {
    const error = new Error('Se requiere usuarioId o autenticación para obtener el feed');
    error.statusCode = 400;
    throw error;
  }

  await procesarVotacionesVencidasService();

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
