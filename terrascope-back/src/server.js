import dotenv from "dotenv";
import app from './app.js';
import { purgeExpired } from './services/ia-cache.service.js';

dotenv.config();
console.log("Database URL:", process.env.DATABASE_URL);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);

  // Limpieza periódica del caché de IA cada hora
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(purgeExpired, ONE_HOUR);
  console.log("[IA Cache] Purge periódico activado (cada 1h)");
});