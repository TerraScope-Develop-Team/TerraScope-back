import express from "express";
import { identificarEspecie, validarRegistroFaunaFlora } from "../controllers/ia.controller.js";

const router = express.Router();

router.post("/identificar", identificarEspecie);
router.post("/validar-registro", validarRegistroFaunaFlora);

export default router;
