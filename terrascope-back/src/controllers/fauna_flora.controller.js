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
      habitad,
      tipo,
      nombre_usuario
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

    
    if (id_usuario && id_usuario !== 'null' && id_usuario !== '000000000000000000000000') {
      
      if (/^[0-9a-fA-F]{24}$/.test(id_usuario)) {
        nuevoComentario.id_usuario = id_usuario;
      }
    }

   
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



export const deleteAvistamiento = async (req, res) => {
  try {
    const avistamiento = await FaunaFlora.findByIdAndDelete(req.params.id);
    if (!avistamiento) return res.status(404).json({ message: "Avistamiento no encontrado" });
    res.status(200).json({ message: "Avistamiento eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar avistamiento", error });
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
