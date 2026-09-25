import FaunaFlora from "../models/fauna_flora.model.js";
import Habitat from "../models/habitat.model.js";
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
      habitat,  // ← CORREGIDO: era "habitad"
      tipo,     // ← AGREGADO: faltaba extraer
    } = req.body;

    // Validar que habitat existe y tiene id_habitat
    if (!habitat || !habitat.id_habitat) {
      console.log('❌ Habitat no proporcionado o sin ID');
      return respondWithError(res, 400, "HABITAT_ID_REQUIRED", "El hábitat es requerido y debe tener un id_habitat");
    }

    console.log('🔍 Validando habitat con ID:', habitat.id_habitat);

    // Validar que el ID es un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(habitat.id_habitat)) {
      console.log('❌ ID de habitat NO es válido');
      return respondWithError(res, 400, "INVALID_HABITAT_ID", "El ID del hábitat no tiene un formato válido");
    }

    // Buscar el habitat en la base de datos
    const habitatExiste = await Habitat.findById(habitat.id_habitat); // ← CORREGIDO: era "habitad.id_habitad"
    
    if (!habitatExiste) {
      console.log('❌ Habitat no encontrado en la base de datos');
      return respondWithError(res, 404, "HABITAT_NOT_FOUND", "Hábitat no encontrado");
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
      nombre_usuario: req.user.nombre_usuario,
      id_usuario: req.user._id,
      validacion: {
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
    
    // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return respondWithError(res, 400, "SIGHTING_VALIDATION_ERROR", "Los datos del avistamiento no son válidos", messages);
    }

    return respondWithControllerError(res, error, "Error al crear un avistamiento");
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
    return respondWithControllerError(res, error, "Error al conseguir los avistamientos");
  }
};

// Obtener por ID
export const getAvistamientoById = async (req, res) => {
  try {
    const avistamiento = await FaunaFlora.findById(req.params.id);
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }
    res.status(200).json(avistamiento);
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

// Agregar comentario 
export const addComentario = async (req, res) => {
  try {
    const { comentario } = req.body;
    
    if (!comentario) {
      return respondWithError(res, 400, "COMMENT_FIELDS_REQUIRED", "El comentario es requerido");
    }

    const avistamiento = await FaunaFlora.findById(req.params.id);
    
    if (!avistamiento) {
      return respondWithError(res, 404, "SIGHTING_NOT_FOUND", "Avistamiento no encontrado");
    }

    const nuevoComentario = {
      nombre_usuario: req.user.nombre_usuario,
      comentario, 
      fecha: new Date(),
      id_usuario: req.user._id
    };

    avistamiento.comentarios.push(nuevoComentario);
    await avistamiento.save();
    
    res.status(200).json(avistamiento);
  } catch (error) {
    console.error("❌ Error al agregar comentario:", error);
    return respondWithControllerError(res, error, "Error al agregar comentario");
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


