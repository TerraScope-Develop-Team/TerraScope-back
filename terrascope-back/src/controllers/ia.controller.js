import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { respondWithControllerError, respondWithError } from "../utils/controller-error.js";
import { optimizeImage } from "../utils/image-optimizer.js";
import { hashImage, getFromCache, setInCache, getCacheStats } from "../services/ia-cache.service.js";

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

    // 1. Calcular hash de la imagen original para caché
    const hash = hashImage(imagen);

    // 2. Consultar caché antes de llamar a Gemini
    const cached = getFromCache(hash);
    if (cached) {
      console.log(`[IA] Respuesta desde caché para hash ${hash.slice(0, 8)}...`);
      return res.status(200).json({ ...cached, cache_hit: true });
    }

    // 3. Optimizar imagen: comprimir y redimensionar
    let imagenOptimizada = imagen;
    let originalBytes = 0;
    let optimizedBytes = 0;

    try {
      const optimized = await optimizeImage(imagen);
      imagenOptimizada = optimized.base64Output;
      originalBytes = optimized.originalBytes;
      optimizedBytes = optimized.optimizedBytes;

      const reduccion = (((originalBytes - optimizedBytes) / originalBytes) * 100).toFixed(1);
      console.log(
        `[IA] Imagen optimizada: ${originalBytes} bytes → ${optimizedBytes} bytes (reduccion: ${reduccion}%)`
      );
    } catch (optErr) {
      console.warn("[IA] No se pudo optimizar la imagen, se enviará en formato original:", optErr.message);
    }

    // 4. Llamar a Gemini con la imagen optimizada
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
      { inlineData: { mimeType: "image/jpeg", data: imagenOptimizada } }
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

    // 5. Guardar resultado en caché
    setInCache(hash, parsed);

    return res.status(200).json({
      ...parsed,
      cache_hit: false,
      _meta: {
        original_bytes: originalBytes,
        optimized_bytes: optimizedBytes,
      }
    });
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

/**
 * GET /api/ia/stats
 * Devuelve métricas del caché de identificación de imágenes.
 */
export const getIaStats = async (req, res) => {
  try {
    const stats = getCacheStats();
    return res.status(200).json({
      message: "Estadísticas del servicio de IA",
      stats,
    });
  } catch (error) {
    return respondWithControllerError(res, error, "Error al obtener estadísticas de IA");
  }
};
