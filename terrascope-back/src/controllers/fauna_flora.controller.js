import prisma from "../config/db.js";
import retosService from "../services/retos.service.js";

// Crear avistamiento
export const createAvistamiento = async (req, res) => {
  try {
    console.log('📥 Datos recibidos en createAvistamiento:');
    console.log(JSON.stringify(req.body, null, 2));

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
      nombre_usuario,
      id_usuario,
      validacion
    } = req.body;

    if (!habitat || !habitat.id_habitat) {
      console.log('❌ Habitat no proporcionado o sin ID');
      return res.status(400).json({
        message: "Habitat es requerido y debe tener un id_habitat"
      });
    }

    // Buscar el habitat en la base de datos
    const habitatExiste = await prisma.habitat.findUnique({
      where: { id: habitat.id_habitat }
    });

    if (!habitatExiste) {
      console.log('❌ Habitat no encontrado en la base de datos');
      return res.status(404).json({
        message: "Habitat no encontrado"
      });
    }

    console.log('✅ Habitat encontrado:', habitatExiste.nombre_habitat);

    console.log('💾 Creando nuevo avistamiento...');

    const nuevoAvistamiento = await prisma.faunaFlora.create({
      data: {
        nombre_comun,
        nombre_cientifico,
        especie,
        descripcion,
        imagen,
        ubicacion: {
          latitud: ubicacion.latitud,
          longitud: ubicacion.longitud
        },
        comportamiento,
        estado_extincion,
        estado_especimen,
        habitat: {
          set: {
            id_habitat: habitat.id_habitat,
            nombre_habitat: habitat.nombre_habitat,
            descripcion_habitat: habitat.descripcion_habitat
          }
        },
        tipo,
        nombre_usuario,
        id_usuario: id_usuario || null,
        validacion: {
          set: {
            estado: validacion?.estado || "pendiente",
            votos_comunidad: validacion?.votos_comunidad || 0,
            requeridos_comunidad: validacion?.requeridos_comunidad || 5,
            validado_por_experto: validacion?.validado_por_experto || false
          }
        }
      }
    });

    console.log('✅ Avistamiento creado exitosamente:', nuevoAvistamiento.id);

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
    res.status(500).json({
      message: "Error al crear un avistamiento",
      error: error.message
    });
  }
};

// Obtener todos con filtros opcionales (enriquecidos con métricas sociales)
export const getAvistamientos = async (req, res) => {
  try {
    const { especie, categoria, usuarioId, id_usuario } = req.query;
    const currentUserId = req.usuario?.id?.toString() || usuarioId || id_usuario;

    let filter = {};
    if (especie) filter.especie = especie;
    if (categoria) filter.especie = categoria;

    const avistamientos = await prisma.faunaFlora.findMany({
      where: filter,
      orderBy: { id: 'desc' },
      include: {
        usuario: {
          select: { nombre_usuario: true, imagen_perfil: true }
        }
      }
    });

    const formatted = avistamientos.map(item => {
      return {
        ...item,
        total_likes: item.likes ? item.likes.length : 0,
        total_comentarios: item.comentarios ? item.comentarios.length : 0,
        user_has_liked: currentUserId && item.likes ? item.likes.includes(currentUserId) : false
      };
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error('❌ Error al obtener avistamientos:', error);
    res.status(500).json({
      message: "Error al conseguir los avistamientos",
      error: error.message
    });
  }
};

// Obtener por ID (enriquecido con métricas sociales)
export const getAvistamientoById = async (req, res) => {
  try {
    const { usuarioId, id_usuario } = req.query;
    const currentUserId = req.usuario?.id?.toString() || usuarioId || id_usuario;

    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: req.params.id },
      include: {
        usuario: {
          select: { nombre_usuario: true, imagen_perfil: true }
        }
      }
    });

    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    res.status(200).json({
      ...avistamiento,
      total_likes: avistamiento.likes ? avistamiento.likes.length : 0,
      total_comentarios: avistamiento.comentarios ? avistamiento.comentarios.length : 0,
      user_has_liked: currentUserId && avistamiento.likes ? avistamiento.likes.includes(currentUserId) : false
    });
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

    if (!comentario || comentario.trim() === "") {
      return res.status(400).json({ message: "El comentario es requerido" });
    }

    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: req.params.id }
    });

    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    const autorId = req.usuario?.id || req.body.id_usuario;
    const autorNombre = req.usuario?.nombre_usuario || req.body.nombre_usuario;
    const autorAvatar = req.usuario?.imagen_perfil || req.body.imagen_perfil || "";

    if (!autorNombre) {
      return res.status(400).json({ message: "Se requiere usuario autenticado o nombre_usuario" });
    }

    let validIdUsuario = null;
    if (autorId && autorId !== 'null' && autorId !== '000000000000000000000000') {
      if (/^[0-9a-fA-F]{24}$/.test(autorId)) {
        validIdUsuario = autorId;
      }
    }

    const nuevoComentario = {
      id_usuario: validIdUsuario,
      nombre_usuario: autorNombre,
      imagen_perfil: autorAvatar,
      comentario: comentario.trim(),
      fecha: new Date()
    };

    const updatedAvistamiento = await prisma.faunaFlora.update({
      where: { id: req.params.id },
      data: {
        comentarios: {
          push: nuevoComentario
        }
      }
    });

    const comentarioCreado = updatedAvistamiento.comentarios[updatedAvistamiento.comentarios.length - 1];

    res.status(201).json({
      message: "Comentario agregado exitosamente",
      comentario: comentarioCreado,
      total_comentarios: updatedAvistamiento.comentarios.length,
      avistamientoId: updatedAvistamiento.id,
      data: updatedAvistamiento
    });
  } catch (error) {
    console.error("❌ Error al agregar comentario:", error);
    res.status(500).json({
      message: "Error al agregar comentario",
      error: error.message
    });
  }
};

export const deleteAvistamiento = async (req, res) => {
  try {
    const avistamiento = await prisma.faunaFlora.delete({
      where: { id: req.params.id }
    });
    res.status(200).json({ message: "Avistamiento eliminado correctamente" });
  } catch (error) {
    console.error('❌ Error al eliminar avistamiento:', error);
    res.status(500).json({
      message: "Error al eliminar avistamiento",
      error: error.message
    });
  }
};

export const getFrequentZones = async (req, res) => {
  try {
    // Prisma mongo raw aggregation
    const frequentZones = await prisma.faunaFlora.aggregateRaw({
      pipeline: [
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
      ]
    });
    res.status(200).json(frequentZones);
  } catch (error) {
    console.error('❌ Error al obtener zonas frecuentes:', error);
    res.status(500).json({
      message: "Error al obtener zonas frecuentes",
      error: error.message
    });
  }
};

// Votar por comunidad
export const votarValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const id_usuario = req.usuario?.id || req.user?.id || req.body?.id_usuario;

    if (!id_usuario) {
      return res.status(400).json({ message: "Se requiere el id_usuario" });
    }

    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: avistamientoId }
    });

    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    if (avistamiento.id_usuario && avistamiento.id_usuario.toString() === id_usuario.toString()) {
      return res.status(403).json({ message: "No puedes votar tu propio avistamiento" });
    }

    const validadores = avistamiento.usuarios_validadores_ids || [];
    if (validadores.some(v => v.toString() === id_usuario.toString())) {
      return res.status(400).json({ message: "Este usuario ya validó este avistamiento" });
    }

    const nuevosVotos = (avistamiento.validacion?.votos_comunidad || 0) + 1;
    let nuevoEstado = avistamiento.validacion?.estado || "pendiente";

    if (nuevosVotos >= (avistamiento.validacion?.requeridos_comunidad || 5)) {
      nuevoEstado = "validado_comunidad";
    }

    const updatedAvistamiento = await prisma.faunaFlora.update({
      where: { id: avistamientoId },
      data: {
        usuarios_validadores_ids: {
          push: id_usuario
        },
        validacion: {
          estado: nuevoEstado,
          votos_comunidad: nuevosVotos,
          requeridos_comunidad: avistamiento.validacion?.requeridos_comunidad || 5,
          validado_por_experto: avistamiento.validacion?.validado_por_experto || false
        }
      }
    });

    res.status(200).json({
      message: "Voto registrado correctamente",
      estado_actual: updatedAvistamiento.validacion.estado,
      votos_comunidad: updatedAvistamiento.validacion.votos_comunidad,
    });

  } catch (error) {
    console.error('❌ Error al registrar voto:', error);
    res.status(500).json({
      message: "Error al registrar el voto",
      error: error.message
    });
  }
};

// Validación por experto
export const validarPorExperto = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const id_usuario = req.usuario?.id || req.user?.id || req.body?.id_usuario;
    const rol = req.usuario?.rol || req.user?.rol || req.body?.rol;

    if (!id_usuario || !rol) {
      return res.status(400).json({ message: "Se requiere id_usuario y rol" });
    }

    if (!["Investigador", "Administrador"].includes(rol)) {
      return res.status(403).json({ message: "Usuario no autorizado para validar como experto" });
    }

    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: avistamientoId }
    });

    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    const updatedAvistamiento = await prisma.faunaFlora.update({
      where: { id: avistamientoId },
      data: {
        validacion: {
          estado: "validado_experto",
          votos_comunidad: avistamiento.validacion?.votos_comunidad || 0,
          requeridos_comunidad: avistamiento.validacion?.requeridos_comunidad || 5,
          validado_por_experto: true
        }
      }
    });

    res.status(200).json({
      message: "Avistamiento validado por experto",
      estado_actual: updatedAvistamiento.validacion.estado,
    });

  } catch (error) {
    console.error('❌ Error al validar por experto:', error);
    res.status(500).json({
      message: "Error al validar por experto",
      error: error.message
    });
  }
};

export const obtenerEstadoValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    // Si la ruta tiene verificarToken, usar req.usuario.id. Si no, permitir req.query.userId
    const userId = req.usuario?.id || req.query.userId || req.body.id_usuario;

    if (!userId) return res.status(400).json({ message: 'Falta el userId' });

    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: avistamientoId }
    });

    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    const validacion = avistamiento.validacion;
    const yaVoto = avistamiento.usuarios_validadores_ids?.some(v => v.toString() === userId.toString()) ?? false;

    res.status(200).json({
      estado: validacion?.estado || "pendiente",
      votos_comunidad: validacion?.votos_comunidad || 0,
      requeridos_comunidad: validacion?.requeridos_comunidad || 5,
      validado_por_experto: validacion?.validado_por_experto || false,
      usuarios_validadores: avistamiento.usuarios_validadores_ids || [],
      yaVoto,
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ message: "Error al obtener estado", error: error.message });
  }
};

// Feed consolidado: Avistamientos de los usuarios a los que sigo
export const getFeedAvistamientos = async (req, res) => {
  try {
    const currentUserId = req.usuario?.id?.toString() || req.query.usuarioId || req.query.id_usuario;

    if (!currentUserId) {
      return res.status(400).json({ message: "Se requiere usuarioId o autenticación para obtener el feed" });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: currentUserId } });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!usuario.seguidos || usuario.seguidos.length === 0) {
      return res.status(200).json({
        message: "Aún no sigues a ningún usuario. Sigue a otros exploradores para ver sus avistamientos aquí.",
        feed: [],
        total: 0
      });
    }

    const avistamientos = await prisma.faunaFlora.findMany({
      where: { id_usuario: { in: usuario.seguidos } },
      orderBy: { id: 'desc' },
      include: {
        usuario: {
          select: { nombre_usuario: true, imagen_perfil: true }
        }
      }
    });

    const feed = avistamientos.map((item) => {
      return {
        ...item,
        total_likes: item.likes ? item.likes.length : 0,
        total_comentarios: item.comentarios ? item.comentarios.length : 0,
        user_has_liked: item.likes ? item.likes.includes(currentUserId) : false
      };
    });

    res.status(200).json({
      message: "Feed obtenido exitosamente",
      feed,
      total: feed.length
    });
  } catch (error) {
    console.error("❌ Error al obtener feed de avistamientos:", error);
    res.status(500).json({ message: "Error al obtener el feed", error: error.message });
  }
};

// Alternar "like" en un avistamiento (dar y quitar sin duplicar)
export const toggleLikeAvistamiento = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.usuario?.id?.toString() || req.body.id_usuario || req.body.usuarioId;

    if (!userId) {
      return res.status(400).json({ message: "Se requiere autenticación o id_usuario para dar o quitar like" });
    }

    const avistamiento = await prisma.faunaFlora.findUnique({ where: { id } });
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    const likes = avistamiento.likes || [];
    const yaDioLike = likes.includes(userId);

    const updatedLikes = yaDioLike
      ? likes.filter(likeId => likeId !== userId)
      : [...likes, userId];

    const updatedAvistamiento = await prisma.faunaFlora.update({
      where: { id },
      data: { likes: updatedLikes }
    });

    res.status(200).json({
      message: yaDioLike ? "Like removido" : "Like agregado exitosamente",
      liked: !yaDioLike,
      total_likes: updatedAvistamiento.likes.length,
      avistamientoId: updatedAvistamiento.id
    });
  } catch (error) {
    console.error("❌ Error al alternar like:", error);
    res.status(500).json({ message: "Error al procesar el like", error: error.message });
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

    const avistamiento = await prisma.faunaFlora.findUnique({ where: { id } });
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    const comentario = avistamiento.comentarios.find(c => c.id === comentarioId);
    if (!comentario) {
      return res.status(404).json({ message: "Comentario no encontrado" });
    }

    const esAutor = comentario.id_usuario === solicitanteId;
    const esAdmin = req.usuario?.rol === "Administrador";

    if (!esAutor && !esAdmin) {
      return res.status(403).json({
        message: "No tienes permisos para eliminar este comentario. Solo el autor o un Administrador pueden eliminarlo."
      });
    }

    const updatedComentarios = avistamiento.comentarios.filter(c => c.id !== comentarioId);

    const updatedAvistamiento = await prisma.faunaFlora.update({
      where: { id },
      data: { comentarios: updatedComentarios }
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
    res.status(500).json({ message: "Error al eliminar comentario", error: error.message });
  }
};
