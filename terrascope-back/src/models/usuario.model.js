import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
    required: true,
    select: false
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
    titulo_activo: {
    id_logro: { type: String },
    nombre_logro: { type: String },
    descripcion_titulo: { type: String },
    },
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
  }],
  seguidores: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario"
  }],
  seguidos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario"
  }]
}, {
  collection: "usuarios",
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

UsuarioSchema.virtual("total_seguidores").get(function () {
  return this.seguidores ? this.seguidores.length : 0;
});

UsuarioSchema.virtual("total_seguidos").get(function () {
  return this.seguidos ? this.seguidos.length : 0;
});

UsuarioSchema.pre("save", async function (next) {
  if (!this.isModified("contrasenia_usuario")) {
    return next();
  }

  this.contrasenia_usuario = await bcrypt.hash(this.contrasenia_usuario, 12);
  next();
});

UsuarioSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.contrasenia_usuario;
    return ret;
  }
});

export default mongoose.model("Usuario", UsuarioSchema);
