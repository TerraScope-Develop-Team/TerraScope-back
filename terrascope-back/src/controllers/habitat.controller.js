import prisma from "../config/db.js";
import { parsePagination, paginateResults } from "../utils/pagination.js";

// Autor: César González
// Fecha: 2025-10-03
// Descripción: Controladores para manejar las operaciones CRUD de hábitats

// Crear un nuevo hábitat
export const createHabitat = async (req, res) => {
  try {
    const { nombre_habitat, descripcion_habitat } = req.body;
    
    if (!nombre_habitat || !descripcion_habitat) {
      return res.status(400).json({
        message: "Nombre y descripción del hábitat son requeridos"
      });
    }
    
    const savedHabitat = await prisma.habitat.create({
      data: {
        nombre_habitat,
        descripcion_habitat
      }
    });
    
    console.log('✅ Hábitat creado:', savedHabitat);
    
    res.status(201).json({
      message: "Hábitat creado exitosamente",
      habitat: savedHabitat
    });
  } catch (error) {
    console.error("❌ Error creando hábitat:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      error: error.message
    });
  }
};

// Obtener todos los hábitats
export const getAllHabitats = async (req, res) => {
  try {
    const pagination = parsePagination(req.query, 100);
    if (!pagination.validCursor) {
      return res.status(400).json({ message: "El cursor debe ser un ObjectId válido" });
    }

    const records = await prisma.habitat.findMany({
      where: pagination.cursor ? { id: { lt: pagination.cursor } } : undefined,
      orderBy: { id: "desc" },
      take: pagination.limit + 1,
    });
    const { items: habitats, hasMore, nextCursor } = paginateResults(res, records, pagination.limit);
    
    // 📋 Debug: Ver qué estás enviando
    console.log('📤 Total de hábitats encontrados:', habitats.length);
    if (habitats.length > 0) {
      console.log('🔍 Primer hábitat:', JSON.stringify(habitats[0], null, 2));
      console.log('🔑 id del primer hábitat:', habitats[0].id);
    }
    
    res.json({
      message: "Hábitats obtenidos exitosamente",
      habitats,
      pagination: { limit: pagination.limit, has_more: hasMore, next_cursor: nextCursor }
    });
  } catch (error) {
    console.error("❌ Error obteniendo hábitats:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      error: error.message
    });
  }
};

// Obtener un hábitat por ID
export const getHabitatById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Buscando hábitat con ID:', id);
    
    const habitat = await prisma.habitat.findUnique({
      where: { id }
    });
    
    if (!habitat) {
      console.log('⚠️ Hábitat no encontrado con ID:', id);
      return res.status(404).json({
        message: "Hábitat no encontrado"
      });
    }
    
    console.log('✅ Hábitat encontrado:', habitat);
    
    res.json({
      message: "Hábitat obtenido exitosamente",
      habitat
    });
  } catch (error) {
    console.error("❌ Error obteniendo hábitat:", error);
    // Prisma tira un error de validación si el ID no es de tipo ObjectId (24 char hex string)
    if (error.code === 'P2023') {
      return res.status(400).json({
        message: "ID de hábitat inválido"
      });
    }
    res.status(500).json({
      message: "Error interno del servidor",
      error: error.message
    });
  }
};

// Actualizar un hábitat
export const updateHabitat = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_habitat, descripcion_habitat } = req.body; 
    
    console.log('🔄 Actualizando hábitat ID:', id);
    console.log('📝 Nuevos datos:', { nombre_habitat, descripcion_habitat });
    
    const updatedHabitat = await prisma.habitat.update({
      where: { id },
      data: { nombre_habitat, descripcion_habitat }
    });
    
    console.log('✅ Hábitat actualizado:', updatedHabitat);
    
    res.json({
      message: "Hábitat actualizado exitosamente",
      habitat: updatedHabitat
    });
  } catch (error) {
    console.error("❌ Error actualizando hábitat:", error);
    if (error.code === 'P2025') { // Record to update not found
      console.log('⚠️ Hábitat no encontrado para actualizar:', id);
      return res.status(404).json({
        message: "Hábitat no encontrado"
      });
    }
    if (error.code === 'P2023') {
      return res.status(400).json({
        message: "ID de hábitat inválido"
      });
    }
    res.status(500).json({
      message: "Error interno del servidor",
      error: error.message
    });
  }
};

// Eliminar un hábitat
export const deleteHabitat = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Eliminando hábitat ID:', id);
    
    const deletedHabitat = await prisma.habitat.delete({
      where: { id }
    });
    
    console.log('✅ Hábitat eliminado:', deletedHabitat);
    
    res.json({
      message: "Hábitat eliminado exitosamente",
      habitat: deletedHabitat
    });
  } catch (error) {
    console.error("❌ Error eliminando hábitat:", error);
    if (error.code === 'P2025') {
      console.log('⚠️ Hábitat no encontrado para eliminar:', id);
      return res.status(404).json({
        message: "Hábitat no encontrado"
      });
    }
    if (error.code === 'P2023') {
      return res.status(400).json({
        message: "ID de hábitat inválido"
      });
    }
    res.status(500).json({
      message: "Error interno del servidor",
      error: error.message
    });
  }
};