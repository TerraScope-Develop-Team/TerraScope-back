import { Router } from "express";
import {
  registerSOS,
  getSOSAlerts,
  getDangerousFaunaAlerts,
  markDangerousFaunaAlertShown,
  markDangerousFaunaAlertRead,
  getNearbyDangerousAlerts,
  updateAlertSettings,
  updateLocation
} from "../controllers/alerta.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

// SOS
router.post("/sos", verificarToken, registerSOS);
router.get("/sos", verificarToken, getSOSAlerts); // Idealmente protegido por requireRoles("Administrador")

// Alertas de peligro
router.get("/peligro", verificarToken, getDangerousFaunaAlerts);
router.patch("/peligro/:alertId/mostrada", verificarToken, markDangerousFaunaAlertShown);
router.patch("/peligro/:alertId/leida", verificarToken, markDangerousFaunaAlertRead);
router.get("/peligro/cercanos", verificarToken, getNearbyDangerousAlerts);

// Configuración y ubicación del usuario para alertas
router.patch("/configuracion", verificarToken, updateAlertSettings);
router.patch("/ubicacion", verificarToken, updateLocation);

export default router;
