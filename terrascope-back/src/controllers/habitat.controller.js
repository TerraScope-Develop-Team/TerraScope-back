import Habitat from "../models/habitat.model.js";
import { respondWithControllerError, respondWithError } from "../utils/controller-error.js";
// Autor: César González
// Fecha: 2025-10-03
// Descripción: Controladores para manejar las operaciones CRUD de hábitats

// Crear un nuevo hábitat
export const createHabitat = async (req, res) => {
  try {
    const { nombre_habitat, descripcion_habitat } = req.body;
    
    if (!nombre_habitat || !descripcion_habitat) {
      return respondWithError(res, 400, "HABITAT_FIELDS_REQUIRED", "Nombre y descripción del hábitat son requeridos");
    }
    
    const newHabitat = new Habitat({
      nombre_habitat,
      descripcion_habitat
    });
    
    const savedHabitat = await newHabitat.save();
    
    console.log('✅ Hábitat creado:', savedHabitat);
    
    res.status(201).json({
      message: "Hábitat creado exitosamente",
      data: savedHabitat
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al crear el hábitat");
  }
};

// Obtener todos los hábitats
export const getAllHabitats = async (req, res) => {
  try {
    const habitats = await Habitat.find();
    
    // 📋 Debug: Ver qué estás enviando
    console.log('📤 Total de hábitats encontrados:', habitats.length);
    if (habitats.length > 0) {
      console.log('🔍 Primer hábitat:', JSON.stringify(habitats[0], null, 2));
      console.log('🔑 _id del primer hábitat:', habitats[0]._id);
    }
    
    res.status(200).json({
      message: "Hábitats obtenidos exitosamente",
      data: habitats
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener los hábitats");
  }
};

// Obtener un hábitat por ID
export const getHabitatById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Buscando hábitat con ID:', id);
    
    const habitat = await Habitat.findById(id);
    
    if (!habitat) {
      console.log('⚠️ Hábitat no encontrado con ID:', id);
      return respondWithError(res, 404, "HABITAT_NOT_FOUND", "Hábitat no encontrado");
    }
    
    console.log('✅ Hábitat encontrado:', habitat);
    
    res.status(200).json({
      message: "Hábitat obtenido exitosamente",
      data: habitat
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener el hábitat");
  }
};

// Actualizar un hábitat
export const updateHabitat = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_habitat, descripcion_habitat } = req.body; // ⚠️ CORREGIDO: estaba "nombre_habitad"
    
    console.log('🔄 Actualizando hábitat ID:', id);
    console.log('📝 Nuevos datos:', { nombre_habitat, descripcion_habitat });
    
    const updatedHabitat = await Habitat.findByIdAndUpdate(
      id,
      { nombre_habitat, descripcion_habitat }, // ⚠️ CORREGIDO
      { new: true, runValidators: true }
    );
    
    if (!updatedHabitat) {
      console.log('⚠️ Hábitat no encontrado para actualizar:', id);
      return respondWithError(res, 404, "HABITAT_NOT_FOUND", "Hábitat no encontrado");
    }
    
    console.log('✅ Hábitat actualizado:', updatedHabitat);
    
    res.status(200).json({
      message: "Hábitat actualizado exitosamente",
      data: updatedHabitat
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al actualizar el hábitat");
  }
};

// Eliminar un hábitat
export const deleteHabitat = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Eliminando hábitat ID:', id);
    
    const deletedHabitat = await Habitat.findByIdAndDelete(id);
    
    if (!deletedHabitat) {
      console.log('⚠️ Hábitat no encontrado para eliminar:', id);
      return respondWithError(res, 404, "HABITAT_NOT_FOUND", "Hábitat no encontrado");
    }
    
    console.log('✅ Hábitat eliminado:', deletedHabitat);
    
    res.status(200).json({
      message: "Hábitat eliminado exitosamente",
      data: deletedHabitat
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al eliminar el hábitat");
  }
};