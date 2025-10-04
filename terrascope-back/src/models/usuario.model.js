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
  }
}, {
  collection: "usuarios", 
  timestamps: true        
});

// ✅ Cambiar module.exports por export default
export default mongoose.model("Usuario", UsuarioSchema);
