import mongoose from "mongoose" ;

//models fauna_flora

const faunaFloraSchema = new mongoose.Schema({
    nombre_comun: {
        type: String,
        required: true
    },
    nombre_cientifico: {
        type: String,
        required: true
    },
    especie: {
        type: String,
        required: true
    },
    descripcion: {
        type: String,
        required: true
    },
    imagen: {
        type: String,
        required: true //almacena base64
    },
    tipo:{
        type:String,
        required:true
    },
    nombre_usuario:{
        type:String,
        required:true
    },
   ubicacion: {
    latitud: { type: Number, required: true },
    longitud: { type: Number, required: true }
    },
    comportamiento: {
        type: String,
        required: true
    },
    estado_extincion: { type: String, required: true },
    estado_especimen: { type: String, required: true },
   habitad: {
  id_habitad: { type: mongoose.Schema.Types.ObjectId, ref: "habitat" },
  nombre_habitad: { type: String },
  descripcion_habitat: { type: String }
   },
    comentarios: [{
    id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: "usuarios", required: false  },
    nombre_usuario: { type: String, required: true },
    comentario: { type: String, required: true },
    fecha: { type: Date, required: true }
}]


})
const fauna_flora = mongoose.model("FaunaFlora", faunaFloraSchema, "fauna_flora");
export default fauna_flora;
