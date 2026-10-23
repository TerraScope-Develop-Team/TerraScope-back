import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import app from './app.js';
import { purgeExpired } from './services/ia-cache.service.js';
import { purgeExpiredRateLimits } from './services/rate-limiter.service.js';
import { procesarVotacionesVencidasService } from './services/fauna_flora.service.js';

dotenv.config();
console.log("Database URL:", process.env.DATABASE_URL);
const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"]
  }
});

// Guardar la instancia de socket.io en app para usarla en los controladores
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);
  
  // Un usuario puede unirse a una "sala" con su ID para notificaciones directas
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`Usuario ${userId} unido a su sala`);
  });

  socket.on("disconnect", () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);

  // Limpieza periódica del caché de IA cada hora
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(purgeExpired, ONE_HOUR);
  console.log("[IA Cache] Purge periódico activado (cada 1h)");

  // Limpieza periódica de registros de rate limit cada 10 minutos
  const TEN_MINUTES = 10 * 60 * 1000;
  setInterval(purgeExpiredRateLimits, TEN_MINUTES);
  console.log("[Rate Limit] Purge periódico activado (cada 10 min)");

  // Evaluación periódica de votaciones vencidas (por defecto cada 1 minuto)
  const votingIntervalMs = Number(process.env.VOTING_CLEANUP_INTERVAL_MS) || 60 * 1000;
  setInterval(async () => {
    try {
      const res = await procesarVotacionesVencidasService();
      if (res.eliminados > 0 || res.validados > 0) {
        console.log(
          `[Votaciones] Vencidas procesadas -> validados: ${res.validados}, eliminados: ${res.eliminados}`
        );
      }
    } catch (error) {
      console.error("[Votaciones] Error en evaluación periódica:", error);
    }
  }, votingIntervalMs);
  console.log(`[Votaciones] Evaluación periódica activada (cada ${votingIntervalMs / 1000}s)`);
});