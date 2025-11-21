import mongoose from "mongoose";

const UsuarioSchema = new mongoose.Schema({
  nombre_usuario: {
    type: String,
    required: true,
    trim: true
  },
  email_usuario: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  contrasenia_usuario: {
    type: String,
    required: true
  },
  telefono_usuario: {
    type: String,
    required: false
  },
  fecha_nac_usuario: {
    type: Date,
    required: false
  },
  imagen_perfil: {
    type: String,
    required: false
  },
  rol: {
    id_rol: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    nombre_rol: {
      type: String,
      required: true,
      enum: ["Administrador", "Investigador", "Usuario"]
    }
  },
  logros: [{
    id_reto_base: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reto"
    },
    nombre_logro: String,
    descripcion_titulo: String,
    fecha_obtencion: {
      type: Date,
      default: Date.now
    },
    es_mostrado: {
      type: Boolean,
      default: true
    }
  }],
  historial: {
    fauna: {
      Mamífero: { type: Number, default: 0 },
      Ave: { type: Number, default: 0 },
      Reptil: { type: Number, default: 0 },
      Anfibio: { type: Number, default: 0 },
      Pez: { type: Number, default: 0 },
      Insecto: { type: Number, default: 0 }
    },
    flora: {
      Planta: { type: Number, default: 0 },
      Árbol: { type: Number, default: 0 },
      Hierba: { type: Number, default: 0 },
      Hongo: { type: Number, default: 0 }
    }
  },
  retos_activos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reto"
  }]
}, {
  collection: "usuarios",
  timestamps: true
});

export default mongoose.model("Usuario", UsuarioSchema);
