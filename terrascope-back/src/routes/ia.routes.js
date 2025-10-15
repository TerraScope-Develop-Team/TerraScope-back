import express from "express";
import { identificarEspecie } from "../controllers/ia.controller.js";

const router = express.Router();

router.post("/identificar", identificarEspecie);

export default router;
