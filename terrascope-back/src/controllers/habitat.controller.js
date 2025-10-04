import Habitat from "../models/habitat.model.js";

// Autor: César González
// Fecha: 2025-10-03
// Descripción: Controladores para manejar las operaciones CRUD de hábitats

// Crear un nuevo hábitat
export const createHabitat = async (req, res) => {
  try {
    const { nombre_habitad, descripcion_habitad } = req.body;

    if (!nombre_habitad || !descripcion_habitad) {
      return res.status(400).json({
        message: "Nombre y descripción del hábitat son requeridos"
      });
    }

    const newHabitat = new Habitat({
      nombre_habitad,
      descripcion_habitad
    });

    const savedHabitat = await newHabitat.save();

    res.status(201).json({
      message: "Hábitat creado exitosamente",
      habitat: savedHabitat
    });
  } catch (error) {
    console.error("Error creando hábitat:", error);
    res.status(500).json({
      message: "Error interno del servidor"
    });
  }
};

// Obtener todos los hábitats
export const getAllHabitats = async (req, res) => {
  try {
    const habitats = await Habitat.find();
    res.json({
      message: "Hábitats obtenidos exitosamente",
      habitats
    });
  } catch (error) {
    console.error("Error obteniendo hábitats:", error);
    res.status(500).json({
      message: "Error interno del servidor"
    });
  }
};

// Obtener un hábitat por ID
export const getHabitatById = async (req, res) => {
  try {
    const { id } = req.params;

    const habitat = await Habitat.findById(id);

    if (!habitat) {
      return res.status(404).json({
        message: "Hábitat no encontrado"
      });
    }

    res.json({
      message: "Hábitat obtenido exitosamente",
      habitat
    });
  } catch (error) {
    console.error("Error obteniendo hábitat:", error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        message: "ID de hábitat inválido"
      });
    }
    res.status(500).json({
      message: "Error interno del servidor"
    });
  }
};

// Actualizar un hábitat
export const updateHabitat = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_habitad, descripcion_habitad } = req.body;

    const updatedHabitat = await Habitat.findByIdAndUpdate(
      id,
      { nombre_habitad, descripcion_habitad },
      { new: true, runValidators: true }
    );

    if (!updatedHabitat) {
      return res.status(404).json({
        message: "Hábitat no encontrado"
      });
    }

    res.json({
      message: "Hábitat actualizado exitosamente",
      habitat: updatedHabitat
    });
  } catch (error) {
    console.error("Error actualizando hábitat:", error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        message: "ID de hábitat inválido"
      });
    }
    res.status(500).json({
      message: "Error interno del servidor"
    });
  }
};

// Eliminar un hábitat
export const deleteHabitat = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedHabitat = await Habitat.findByIdAndDelete(id);

    if (!deletedHabitat) {
      return res.status(404).json({
        message: "Hábitat no encontrado"
      });
    }

    res.json({
      message: "Hábitat eliminado exitosamente",
      habitat: deletedHabitat
    });
  } catch (error) {
    console.error("Error eliminando hábitat:", error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        message: "ID de hábitat inválido"
      });
    }
    res.status(500).json({
      message: "Error interno del servidor"
    });
  }
};
