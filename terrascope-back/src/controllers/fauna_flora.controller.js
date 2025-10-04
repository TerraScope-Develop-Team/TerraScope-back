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

// Obtener todos
export const getAvistamientos = async (req, res) => {
  try {
    const avistamientos = await FaunaFlora.find(); // sin populate
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
    const avistamiento = await FaunaFlora.findById(req.params.id);
    if (!avistamiento) return res.status(404).json({ message: "Avistamiento no encontrado" });

    avistamiento.comentarios.push({ id_usuario, nombre_usuario, comentario, fecha: new Date() });
    await avistamiento.save();
    res.status(200).json(avistamiento);
  } catch (error) {
    res.status(500).json({ message: "Error al agregar comentario", error });
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
