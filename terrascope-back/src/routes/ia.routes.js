import express from "express";
import { identificarEspecie, validarRegistroFaunaFlora } from "../controllers/ia.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/identificar", authenticate, identificarEspecie);
router.post("/validar-registro", authenticate, validarRegistroFaunaFlora);

export default router;
