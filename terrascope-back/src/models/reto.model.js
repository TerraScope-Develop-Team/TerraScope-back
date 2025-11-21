import mongoose from "mongoose";

const retoSchema = new mongoose.Schema({
  nombre_reto: {
    type: String,
    required: true,
    trim: true
  },
  descripcion_reto: {
    type: String,
    required: true
  },
  fecha_inicio: {
    type: Date,
    default: null
  },
  fecha_final: {
    type: Date,
    default: null
  },
  condiciones: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  usuarios_inscritos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario"
  }],
  usuarios_finalizados: [{
    usuario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario"
    },
    fecha_completado: {
      type: Date,
      default: Date.now
    },
    posicion: {
      type: Number
    }
  }],
  estado: {
    type: String,
    enum: ["activo", "finalizado", "programado"],
    default: "activo"
  },
  es_temporal: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Reto = mongoose.model("Reto", retoSchema, "retos");
export default Reto;
