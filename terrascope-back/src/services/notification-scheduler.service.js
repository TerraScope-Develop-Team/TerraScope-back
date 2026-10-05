import cron from "node-cron";
import prisma from "../config/db.js";
import pushService from "./push-notification.service.js";

let reminderTask;
const REMINDER_WINDOW_HOURS = 24;

export const procesarRetosPorVencer = async (now = new Date()) => {
  const reminderLimit = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);
  const retos = await prisma.reto.findMany({
    where: {
      estado: "activo",
      fecha_final: { gt: now, lte: reminderLimit }
    },
    select: {
      id: true,
      nombre_reto: true,
      fecha_final: true,
      usuarios_inscritos: true,
      usuarios_finalizados: true
    }
  });

  for (const reto of retos) {
    const usuariosFinalizados = new Set(
      (reto.usuarios_finalizados || [])
        .map(({ usuario_id }) => usuario_id)
        .filter(Boolean)
    );
    const destinatarios = [...new Set(reto.usuarios_inscritos || [])]
      .filter((usuarioId) => !usuariosFinalizados.has(usuarioId));

    for (let offset = 0; offset < destinatarios.length; offset += 50) {
      await Promise.all(destinatarios.slice(offset, offset + 50).map((usuarioId) =>
        pushService.notificarRetoPorVencer({ usuarioId, reto })
      ));
    }
  }

  return retos.length;
};

export const iniciarProgramadorNotificaciones = () => {
  if (reminderTask) return reminderTask;

  const schedule = process.env.CHALLENGE_REMINDER_CRON || "*/15 * * * *";
  reminderTask = cron.schedule(schedule, async () => {
    try {
      await procesarRetosPorVencer();
    } catch (error) {
      console.error("Error procesando recordatorios de retos:", error);
    }
  }, { noOverlap: true });

  console.log(`Programador de recordatorios push activo: ${schedule}`);
  return reminderTask;
};