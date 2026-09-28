import { PrismaClient } from '@prisma/client';
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// Opcional: Probar la conexión
prisma.$connect()
  .then(() => console.log("Conectado a MongoDB con Prisma"))
  .catch((err) => console.error("Error conectando con Prisma:", err));

export default prisma;
