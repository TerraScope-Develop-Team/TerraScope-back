import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Usuario from "../src/models/usuario.model.js";

const isBcryptHash = (value) => /^\$2[aby]?\$\d{2}\$/.test(value);

try {
  await mongoose.connect(process.env.MONGO_URI);

  const usuarios = await Usuario.find().select("+contrasenia_usuario");
  let actualizados = 0;

  for (const usuario of usuarios) {
    if (isBcryptHash(usuario.contrasenia_usuario)) {
      continue;
    }

    const hash = await bcrypt.hash(usuario.contrasenia_usuario, 12);
    await Usuario.updateOne(
      { _id: usuario._id },
      { $set: { contrasenia_usuario: hash } }
    );
    actualizados += 1;
  }

  console.log(`Migración completada. Contraseñas actualizadas: ${actualizados}`);
} finally {
  await mongoose.disconnect();
}