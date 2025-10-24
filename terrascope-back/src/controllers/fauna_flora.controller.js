import FaunaFlora from "../models/fauna_flora.model.js";
import Habitat from "../models/habitat.model.js";
import mongoose from "mongoose";

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

// Obtener todos con filtros opcionales
export const getAvistamientos = async (req, res) => {
  try {
    const { especie, categoria } = req.query;
    let filter = {};
    if (especie) filter.especie = especie;
    if (categoria) {
      filter.especie = categoria; // Adjust as needed
    }
    const avistamientos = await FaunaFlora.find(filter);
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
    const avistamiento = await FaunaFlora.findById(req.params.id);
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

    const avistamiento = await FaunaFlora.findById(req.params.id);
    
    if (!avistamiento) {
      return res.status(404).json({ message: "Avistamiento no encontrado" });
    }

    const nuevoComentario = {
      nombre_usuario, 
      comentario, 
      fecha: new Date()
    };

    if (id_usuario && id_usuario !== 'null' && id_usuario !== '000000000000000000000000') {
      if (/^[0-9a-fA-F]{24}$/.test(id_usuario)) {
        nuevoComentario.id_usuario = id_usuario;
      }
    }

    avistamiento.comentarios.push(nuevoComentario);
    await avistamiento.save();
    
    res.status(200).json(avistamiento);
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


