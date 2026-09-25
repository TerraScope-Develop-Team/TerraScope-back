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

// Obtener todos con filtros opcionales
export const getAvistamientos = async (req, res) => {
  try {
    const { especie, categoria } = req.query;
    let filter = {};
    if (especie) filter.especie = especie;
    if (categoria) {
      filter.especie = categoria; 
    }
    const avistamientos = await prisma.faunaFlora.findMany({
      where: filter
    });
    res.status(200).json(avistamientos);
  } catch (error) {
    console.error('❌ Error al obtener avistamientos:', error);
    res.status(500).json({ 
      message: "Error al conseguir los avistamientos", 
      error: error.message 
    });
  }
};

// Obtener por ID
export const getAvistamientoById = async (req, res) => {
  try {
    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: req.params.id }
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

// Agregar comentario 
export const addComentario = async (req, res) => {
  try {
    const { id_usuario, nombre_usuario, comentario } = req.body;
    
    if (!nombre_usuario || !comentario) {
      return res.status(400).json({ 
        message: "nombre_usuario y comentario son requeridos" 
      });
    }

    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: req.params.id }
    });
    
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    let validIdUsuario = null;
    if (id_usuario && id_usuario !== 'null' && id_usuario !== '000000000000000000000000') {
      if (/^[0-9a-fA-F]{24}$/.test(id_usuario)) {
        validIdUsuario = id_usuario;
      }
    }

    const nuevoComentario = {
      nombre_usuario, 
      comentario, 
      fecha: new Date(),
      id_usuario: validIdUsuario
    };

    const updatedAvistamiento = await prisma.faunaFlora.update({
      where: { id: req.params.id },
      data: {
        comentarios: {
          push: nuevoComentario
        }
      }
    });
    
    res.status(200).json(updatedAvistamiento);
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
    const { id_usuario } = req.body;

    if (!id_usuario) {
      return res.status(400).json({ message: "Se requiere el id_usuario" });
    }

    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: avistamientoId }
    });
    
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    if (avistamiento.id_usuario && avistamiento.id_usuario === id_usuario) {
      return res.status(403).json({ message: "No puedes votar tu propio avistamiento" });
    }

    if (avistamiento.usuarios_validadores_ids.includes(id_usuario)) {
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
    const { id_usuario, rol } = req.body;

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
    const userId = req.query.userId;

    if (!userId) return res.status(400).json({ message: 'Falta el userId' });

    const avistamiento = await prisma.faunaFlora.findUnique({
      where: { id: avistamientoId }
    });
    
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    const validacion = avistamiento.validacion;
    const yaVoto = avistamiento.usuarios_validadores_ids?.includes(userId) ?? false;

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
