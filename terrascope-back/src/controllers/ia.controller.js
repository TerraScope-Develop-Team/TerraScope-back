import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { respondWithControllerError, respondWithError } from "../utils/controller-error.js";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const parseJsonResponse = (text) => JSON.parse(
  text.replace(/```json/g, "").replace(/```/g, "").trim()
);

export const identificarEspecie = async (req, res) => {
  try {
    const { imagen } = req.body;

    if (!imagen) {
      return respondWithError(res, 400, "IMAGE_REQUIRED", "No se recibió ninguna imagen en base64");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
Eres un experto en biología y taxonomía. Analiza la imagen y determina la especie del ser vivo que aparece.
Devuelve únicamente un JSON válido con este formato:
{
  "nombre_cientifico": "Nombre científico",
  "nombre_comun": "Nombre común en español",
  "nivel_confianza": "Alto | Medio | Bajo"
}
Si no puedes identificar la especie, usa "Desconocido" y nivel "Bajo".
`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: "image/jpeg", data: imagen } }
    ]);

    let parsed;
    try {
      parsed = parseJsonResponse(result.response.text());
    } catch (error) {
      console.error("Error parseando respuesta de identificación:", error.message);
      parsed = {
        nombre_comun: "Desconocido",
        nombre_cientifico: "Desconocido",
        nivel_confianza: "Bajo"
      };
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Error IA:", error);
    return respondWithControllerError(res, error, "El servicio de identificación no está disponible", 503);
  }
};

export const validarRegistroFaunaFlora = async (req, res) => {
  try {
    const {
      nombre_comun,
      nombre_cientifico,
      especie,
      descripcion,
      tipo,
      comportamiento,
      estado_extincion,
      habitat
    } = req.body;

    if (!nombre_comun || !nombre_cientifico || !especie || !descripcion || !habitat?.nombre_habitat) {
      return respondWithError(
        res,
        400,
        "VALIDATION_FIELDS_REQUIRED",
        "Faltan campos obligatorios para la validación contextual"
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
Eres un experto en biología y validación de datos ecológicos.
Analiza si estos datos son coherentes y realistas:
- Nombre común: ${nombre_comun}
- Nombre científico: ${nombre_cientifico}
- Tipo: ${tipo}
- Especie: ${especie}
- Descripción: ${descripcion}
- Comportamiento: ${comportamiento}
- Estado de extinción: ${estado_extincion}
- Hábitat: ${habitat.nombre_habitat}
- Descripción del hábitat: ${habitat.descripcion_habitat || "No especificada"}

Devuelve únicamente un JSON válido:
{
  "es_coherente": true,
  "errores_detectados": [],
  "sugerencia": "Texto breve"
}
`;

    const result = await model.generateContent([prompt]);
    let parsed;
    try {
      parsed = parseJsonResponse(result.response.text());
    } catch (error) {
      console.error("Error parseando respuesta de validación:", error.message);
      parsed = {
        es_coherente: false,
        errores_detectados: ["No fue posible interpretar la respuesta del modelo"],
        sugerencia: "Verifica los datos e inténtalo nuevamente"
      };
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Error en validación IA:", error);
    return respondWithControllerError(res, error, "El servicio de validación no está disponible", 503);
  }
};
