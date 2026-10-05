import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import app from './app.js';
import { purgeExpired } from './services/ia-cache.service.js';

dotenv.config();
console.log("Database URL:", process.env.DATABASE_URL);
const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"]
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
});