const FaunaFlora =require("../models/fauna_flora.model");
//Crear un avistamiento
exports.createAvistamiento = async (req,res)=> {

    try{
        const{
            nombre_comun,
            nombre_cientifico,
            especie,
            descripcion,
            imagen,
            ubicacion,
            comportamiento,
            estado_extincion,
            estado_especimen, 
            habitatA,
            comentarios
        } = req.body;

        //¿Existe un habitat?
        const habitatExiste = await Habitat.findById() //Cambiar en la base de datos
    }catch(error){
        res.status(500).json({message: "Error al crear un avistamiento"});
    }

}