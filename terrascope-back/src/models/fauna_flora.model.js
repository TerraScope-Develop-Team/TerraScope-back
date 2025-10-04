const mongoose = require('mongoose');

//models fauna_flora

const fauna_flora = new mongoose.Schema({
    nombre_comun: {
        type: String,
        require: true
    },
    nombre_cientifico: {
        type: String,
        requiere: true
    },
    especie: {
        type: String,
        requiere: true
    },
    descripcion: {
        type: String,
        requiere: true
    },
    imagen: {
        type: String,
        require: true //almacena base64
    },
    ubicacion: {
        latitud: { type: Number, require: true },
        longitud: { type: Number, require: true }


    },
    comportamiento: {
        type: String,
        requiere: true
    },
    estado_extincion: { type: String, requiere: true },
    estado_especimen: { type: String, requiere: true },
    habitatA: {
        id_habitat: { type: mongoose.Schema.Types.ObjectId, ref: "habitat" },
        nombre_habitat: { type: String, requiere: true },
        descripcion_habitat: { type: String, requiere: true }

    },
    comentarios:{
        id_usuario:{type: mongoose.Schema.Types.ObjectId, ref: "usuarios"},
        nombre_usuario:{type: String, require:true},
        comentario:{type:String,requiere: true},
        fecha:{type:Date, requiere: true}
    }


})