import FaunaFlora from "../models/fauna_flora.model.js";
import Habitat from "../models/habitat.model.js";
import Usuario from "../models/usuario.model.js";
import mongoose from "mongoose";
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
      habitat,  // ← CORREGIDO: era "habitad"
      tipo,     // ← AGREGADO: faltaba extraer
      nombre_usuario,  // ← AGREGADO: faltaba extraer
      id_usuario,  // ← AGREGADO: faltaba extraer
      validacion  // ← AGREGADO: faltaba extraer (opcional)
    } = req.body;

    // Validar que habitat existe y tiene id_habitat
    if (!habitat || !habitat.id_habitat) {
      console.log('❌ Habitat no proporcionado o sin ID');
      return res.status(400).json({ 
        message: "Habitat es requerido y debe tener un id_habitat" 
      });
    }

    console.log('🔍 Validando habitat con ID:', habitat.id_habitat);

    // Validar que el ID es un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(habitat.id_habitat)) {
      console.log('❌ ID de habitat NO es válido');
      return res.status(400).json({ 
        message: "ID de habitat inválido" 
      });
    }

    // Buscar el habitat en la base de datos
    const habitatExiste = await Habitat.findById(habitat.id_habitat); // ← CORREGIDO: era "habitad.id_habitad"
    
    if (!habitatExiste) {
      console.log('❌ Habitat no encontrado en la base de datos');
      return res.status(404).json({ 
        message: "Habitat no encontrado" 
      });
    }

    console.log('✅ Habitat encontrado:', habitatExiste.nombre_habitat);

    // Convertir id_habitat a ObjectId
    const habitatData = {
      id_habitat: new mongoose.Types.ObjectId(habitat.id_habitat),
      nombre_habitat: habitat.nombre_habitat,
      descripcion_habitat: habitat.descripcion_habitat
    };

    console.log('💾 Creando nuevo avistamiento...');

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
      habitat: habitatData,  // ← CORREGIDO: era "habitad"
      tipo,
      nombre_usuario,
      id_usuario,
      validacion: validacion || {  // ← Usar valores por defecto si no viene
        estado: "pendiente",
        votos_comunidad: 0,
        requeridos_comunidad: 5,
        usuarios_validadores: [],
        validado_por_experto: false
      }
    });

    console.log('💾 Guardando en base de datos...');
    await nuevoAvistamiento.save();
    
    console.log('✅ Avistamiento creado exitosamente:', nuevoAvistamiento._id);
    // Al final de createAvistamiento, antes del res.status(201).json
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
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    
    // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Error de validación",
        detalles: messages
      });
    }

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
    const currentUserId = req.usuario?._id || usuarioId || id_usuario;
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
    const currentUserId = req.usuario?._id || usuarioId || id_usuario;

    const avistamiento = await FaunaFlora.findById(req.params.id)
      .populate("id_usuario", "nombre_usuario imagen_perfil")
      .populate("comentarios.id_usuario", "nombre_usuario imagen_perfil");

    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
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
    res.status(500).json({ 
      message: "Error al obtener el avistamiento", 
      error: error.message 
    });
  }
};

// Feed consolidado: Avistamientos de los usuarios a los que sigo
export const getFeedAvistamientos = async (req, res) => {
  try {
    const currentUserId = req.usuario?._id || req.query.usuarioId || req.query.id_usuario;

    if (!currentUserId) {
      return res.status(400).json({ 
        message: "Se requiere usuarioId o id_usuario para obtener el feed personalizado" 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    const usuario = await Usuario.findById(currentUserId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Si no sigue a nadie, devolver feed vacío amigable
    if (!usuario.seguidos || usuario.seguidos.length === 0) {
      return res.status(200).json({
        message: "Aún no sigues a ningún usuario. Sigue a otros exploradores para ver sus avistamientos aquí.",
        feed: [],
        total: 0
      });
    }

    // Buscar avistamientos creados por usuarios que sigo
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
    res.status(500).json({
      message: "Error al obtener el feed",
      error: error.message
    });
  }
};

// Alternar "like" en un avistamiento (dar y quitar sin duplicar)
export const toggleLikeAvistamiento = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.usuario?._id || req.body.id_usuario || req.body.usuarioId;

    if (!userId) {
      return res.status(400).json({ message: "Se requiere id_usuario para dar o quitar like" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    const avistamiento = await FaunaFlora.findById(id);
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    if (!avistamiento.likes) {
      avistamiento.likes = [];
    }

    const yaDioLike = avistamiento.likes.some(
      (likeId) => likeId.toString() === userId.toString()
    );

    if (yaDioLike) {
      // Quitar like
      avistamiento.likes = avistamiento.likes.filter(
        (likeId) => likeId.toString() !== userId.toString()
      );
    } else {
      // Agregar like (garantizado único)
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
    res.status(500).json({
      message: "Error al procesar el like",
      error: error.message
    });
  }
};

// Agregar comentario (asociado a avistamiento y autor con fecha/hora)
export const addComentario = async (req, res) => {
  try {
    const { id_usuario, nombre_usuario, comentario, imagen_perfil } = req.body;
    const finalUserId = req.usuario?._id || id_usuario;
    
    if (!comentario || comentario.trim() === "") {
      return res.status(400).json({ 
        message: "El comentario no puede estar vacío" 
      });
    }

    const avistamiento = await FaunaFlora.findById(req.params.id);
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    let autorNombre = nombre_usuario;
    let autorAvatar = imagen_perfil || "";

    // Si viene id de usuario válido, sincronizar información más reciente del autor
    if (finalUserId && mongoose.Types.ObjectId.isValid(finalUserId)) {
      const usuarioEncontrado = req.usuario || await Usuario.findById(finalUserId);
      if (usuarioEncontrado) {
        autorNombre = usuarioEncontrado.nombre_usuario || autorNombre;
        autorAvatar = usuarioEncontrado.imagen_perfil || autorAvatar;
      }
    }

    if (!autorNombre) {
      return res.status(400).json({ message: "Se requiere nombre_usuario o un usuario autenticado" });
    }

    const nuevoComentario = {
      id_usuario: finalUserId && mongoose.Types.ObjectId.isValid(finalUserId) ? finalUserId : undefined,
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
      avistamientoId: avistamiento._id
    });
  } catch (error) {
    console.error("❌ Error al agregar comentario:", error);
    res.status(500).json({ 
      message: "Error al agregar comentario", 
      error: error.message 
    });
  }
};

// Eliminar comentario con moderación (Autor o Administrador)
export const deleteComentario = async (req, res) => {
  try {
    const { id, comentarioId } = req.params;
    const solicitanteId = req.usuario?._id || req.body.id_usuario || req.query.id_usuario;

    if (!solicitanteId) {
      return res.status(401).json({
        message: "Se requiere identificación de usuario (id_usuario) para eliminar un comentario"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(comentarioId)) {
      return res.status(400).json({ message: "ID de avistamiento o comentario inválido" });
    }

    const avistamiento = await FaunaFlora.findById(id);
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    const comentario = avistamiento.comentarios.id(comentarioId);
    if (!comentario) {
      return res.status(404).json({ message: "Comentario no encontrado" });
    }

    // Comprobación de permisos de moderación
    const esAutor = comentario.id_usuario && comentario.id_usuario.toString() === solicitanteId.toString();

    let esAdmin = false;
    if (!esAutor) {
      const usuario = req.usuario || await Usuario.findById(solicitanteId);
      esAdmin = usuario?.rol?.nombre_rol === "Administrador";
    }

    if (!esAutor && !esAdmin) {
      return res.status(403).json({
        message: "No tienes permisos para eliminar este comentario. Solo el autor del comentario o un Administrador pueden eliminarlo."
      });
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
    res.status(500).json({
      message: "Error al eliminar comentario",
      error: error.message
    });
  }
};


export const deleteAvistamiento = async (req, res) => {
  try {
    const avistamiento = await FaunaFlora.findByIdAndDelete(req.params.id);
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }
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
    const { id_usuario } = req.body;

    if (!id_usuario) {
      return res.status(400).json({ message: "Se requiere el id_usuario" });
    }

    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    if (avistamiento.id_usuario && avistamiento.id_usuario.toString() === id_usuario) {
      return res.status(403).json({ message: "No puedes votar tu propio avistamiento" });
    }

    if (avistamiento.validacion.usuarios_validadores.includes(id_usuario)) {
      return res.status(400).json({ message: "Este usuario ya validó este avistamiento" });
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
    const { id_usuario, rol } = req.body;

    if (!id_usuario || !rol) {
      return res.status(400).json({ message: "Se requiere id_usuario y rol" });
    }

    if (!["Investigador", "Administrador"].includes(rol)) {
      return res.status(403).json({ message: "Usuario no autorizado para validar como experto" });
    }

    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
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
    res.status(500).json({ 
      message: "Error al validar por experto", 
      error: error.message 
    });
  }
};

export const obtenerEstadoValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const userId = req.query.userId; // o req.body.userId

    if (!userId) return res.status(400).json({ message: 'Falta el userId' });

    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
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
    res.status(500).json({ message: "Error al obtener estado", error: error.message });
  }
};


