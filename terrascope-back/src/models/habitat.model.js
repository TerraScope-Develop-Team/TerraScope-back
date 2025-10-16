import mongoose from "mongoose";

// Autor: César González
// Fecha: 2025-10-03
// Descripción: Modelo de datos para hábitats

const habitatSchema = new mongoose.Schema({
  nombre_habitat: {
    type: String,
    required: true,
    trim: true
  },
  descripcion_habitat: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: false
});

const Habitat = mongoose.model("Habitat", habitatSchema, "habitat");

export default Habitat;
