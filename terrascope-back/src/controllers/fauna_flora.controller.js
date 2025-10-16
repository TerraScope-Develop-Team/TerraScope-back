import FaunaFlora from "../models/fauna_flora.model.js";
import Habitat from "../models/habitat.model.js";

// Crear avistamiento
export const createAvistamiento = async (req, res) => {
  try {
    const { nombre_comun, nombre_cientifico, especie, descripcion, imagen,
      ubicacion, comportamiento, estado_extincion, estado_especimen, habitad } = req.body;

    const habitatExiste = await Habitat.findById(habitad.id_habitad);
    if(!habitatExiste){
      return res.status(404).json({ message: "Habitat no encontrado" });
    }

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
      habitad
    });

    await nuevoAvistamiento.save();
    res.status(201).json(nuevoAvistamiento);

  } catch (error) {
    res.status(500).json({ message: "Error al crear un avistamiento", error });
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
    res.status(500).json({ message: "Error al conseguir los avistamientos", error });
  }
};

// Obtener por ID
export const getAvistamientoById = async (req, res) => {
  try {
    const avistamiento = await FaunaFlora.findById(req.params.id); // sin populate
    if (!avistamiento) return res.status(404).json({ message: "Avistamiento no encontrado" });
    res.status(200).json(avistamiento);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el avistamiento", error });
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

    // Crear el nuevo comentario
    const nuevoComentario = {
      nombre_usuario, 
      comentario, 
      fecha: new Date()
    };

    // Solo agregar id_usuario si existe y es un ObjectId válido
    if (id_usuario && id_usuario !== 'null' && id_usuario !== '000000000000000000000000') {
      // Validar que sea un ObjectId válido
      if (/^[0-9a-fA-F]{24}$/.test(id_usuario)) {
        nuevoComentario.id_usuario = id_usuario;
      }
    }

    // Agregar el comentario
    avistamiento.comentarios.push(nuevoComentario);
    
    await avistamiento.save();
    
    res.status(200).json(avistamiento);
  } catch (error) {
    console.error("Error al agregar comentario:", error);
    res.status(500).json({ 
      message: "Error al agregar comentario", 
      error: error.message 
    });
  }
};


// Eliminar avistamiento
export const deleteAvistamiento = async (req, res) => {
  try {
    const avistamiento = await FaunaFlora.findByIdAndDelete(req.params.id);
    if (!avistamiento) return res.status(404).json({ message: "Avistamiento no encontrado" });
    res.status(200).json({ message: "Avistamiento eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar avistamiento", error });
  }
};

// Obtener zonas frecuentes
export const getFrequentZones = async (req, res) => {
  try {
    // Aggregate to find frequent locations per especie
    const frequentZones = await FaunaFlora.aggregate([
      {
        $group: {
          _id: { lat: "$ubicacion.latitud", lng: "$ubicacion.longitud", especie: "$especie" },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } } // More than 1 sighting
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
    res.status(500).json({ message: "Error al obtener zonas frecuentes", error });
  }
};

// Votar por comunidad
export const votarValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const { id_usuario } = req.body;

    if (!id_usuario) 
      return res.status(400).json({ message: "Se requiere el id_usuario" });

    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) 
      return res.status(404).json({ message: "Avistamiento no encontrado" });

    // Evitar que el creador vote su propio avistamiento
    if (avistamiento.id_usuario && avistamiento.id_usuario.toString() === id_usuario) {
      return res.status(403).json({ message: "No puedes votar tu propio avistamiento" });
    }

    // Evitar votos duplicados
    if (avistamiento.validacion.usuarios_validadores.includes(id_usuario)) {
      return res.status(400).json({ message: "Este usuario ya validó este avistamiento" });
    }

    // Agregar usuario a validadores y sumar voto
    avistamiento.validacion.usuarios_validadores.push(id_usuario);
    avistamiento.validacion.votos_comunidad += 1;

    // Cambiar estado si alcanza los votos requeridos
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
    console.error(error);
    res.status(500).json({ message: "Error al registrar el voto", error: error.message });
  }
};


// Validación por experto
export const validarPorExperto = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const { id_usuario, rol } = req.body;

    if (!id_usuario || !rol) return res.status(400).json({ message: "Se requiere id_usuario y rol" });

    // Solo investigadores o administradores pueden validar
    if (!["Investigador", "Administrador"].includes(rol)) {
      return res.status(403).json({ message: "Usuario no autorizado para validar como experto" });
    }

    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) return res.status(404).json({ message: "Avistamiento no encontrado" });

    avistamiento.validacion.validado_por_experto = true;
    avistamiento.validacion.estado = "validado_experto";

    await avistamiento.save();

    res.status(200).json({
      message: "Avistamiento validado por experto",
      estado_actual: avistamiento.validacion.estado,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al validar por experto", error: error.message });
  }
};

// Obtener estado de validación
export const obtenerEstadoValidacion = async (req, res) => {
  try {
    const avistamientoId = req.params.id;
    const avistamiento = await FaunaFlora.findById(avistamientoId);
    if (!avistamiento) return res.status(404).json({ message: "Avistamiento no encontrado" });

    res.status(200).json(avistamiento.validacion);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el estado de validación", error: error.message });
  }
};
