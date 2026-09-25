import mongoose from "mongoose";

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
    tipo: {
        type: String,
        required: true
    },
    nombre_usuario: {
        type: String,
        required: true
    },
    id_usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: false
    },
    imagen: {
        type: String,
        required: true //almacena base64
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
    habitat: {
        id_habitat: { type: mongoose.Schema.Types.ObjectId, ref: "habitat" },
        nombre_habitat: { type: String },
        descripcion_habitat: { type: String }
    },
    comentarios: [{
        id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: false },
        nombre_usuario: { type: String, required: true },
        imagen_perfil: { type: String, default: "" },
        comentario: { type: String, required: true },
        fecha: { type: Date, default: Date.now }
    }],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario"
    }],
    validacion: {
        estado: {
            type: String,
            enum: ["pendiente", "validado_comunidad", "validado_experto"],
            default: "pendiente",
        },
        votos_comunidad: {
            type: Number,
            default: 0,
        },
        requeridos_comunidad: {
            type: Number,
            default: 5,
        },
        usuarios_validadores: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Usuario",
            },
        ],
        validado_por_experto: {
            type: Boolean,
            default: false,
        },
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

faunaFloraSchema.virtual("total_likes").get(function () {
    return this.likes ? this.likes.length : 0;
});

faunaFloraSchema.virtual("total_comentarios").get(function () {
    return this.comentarios ? this.comentarios.length : 0;
});

const fauna_flora = mongoose.model("FaunaFlora", faunaFloraSchema, "fauna_flora");
export default fauna_flora;

