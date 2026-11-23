import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { respondWithControllerError, respondWithError } from "../utils/controller-error.js";
import { optimizeImage } from "../utils/image-optimizer.js";
import {
  hashImage,
  hashValidationPayload,
  getFromCache,
  setInCache,
  getCacheStats,
} from "../services/ia-cache.service.js";
import {
  createGeminiModelPair,
  generateGeminiContentWithFallback,
  GeminiTimeoutError,
  GeminiRateLimitError,
  isGeminiRateLimitError,
} from "../services/gemini-request.service.js";
import {
  buildIdentificationPrompt,
  buildValidationPrompt,
  fallbackIdentificationResponse,
  fallbackValidationResponse,
  parseJsonResponse,
  validateContextualValidationInput,
  validateIdentificationInput,
} from "../services/ia.service.js";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function handleIaControllerError(res, error, defaultMessage) {
  if (error instanceof GeminiTimeoutError) {
    return respondWithError(res, 504, "GEMINI_TIMEOUT", error.message);
  }
  if (error instanceof GeminiRateLimitError || isGeminiRateLimitError(error)) {
    const message = error instanceof GeminiRateLimitError
      ? error.message
      : "El servicio de IA alcanzó temporalmente su límite de solicitudes. Inténtalo nuevamente en un minuto.";
    return respondWithError(res, 429, "GEMINI_RATE_LIMIT", message);
  }
  return respondWithControllerError(res, error, defaultMessage, 503);
}

export const identificarEspecie = async (req, res) => {
  try {
    let imagen;
    try {
      ({ imagen } = validateIdentificationInput(req.body));
    } catch (error) {
      return respondWithError(res, 400, "IMAGE_REQUIRED", error.message);
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
    let mimeType = "image/jpeg";

    const optimized = await optimizeImage(imagen);
    imagenOptimizada = optimized.base64Output;
    originalBytes = optimized.originalBytes;
    optimizedBytes = optimized.optimizedBytes;
    mimeType = optimized.mimeType;

    if (optimized.wasOptimized) {
      const reduccion = (((originalBytes - optimizedBytes) / originalBytes) * 100).toFixed(1);
      console.log(
        `[IA] Imagen optimizada: ${originalBytes} bytes → ${optimizedBytes} bytes (reduccion: ${reduccion}%)`
      );
    } else {
      console.warn("[IA] No se pudo optimizar la imagen; se enviará en su formato original.");
    }

    // 4. Llamar a Gemini con la imagen optimizada
    const { primaryModel, fallbackModel } = createGeminiModelPair(genAI);
    const prompt = buildIdentificationPrompt();
    const content = [
      prompt,
      { inlineData: { mimeType, data: imagenOptimizada } },
    ];

    const result = await generateGeminiContentWithFallback(primaryModel, fallbackModel, content);

    let parsed;
    try {
      parsed = parseJsonResponse(result.response.text());
    } catch (error) {
      console.error("Error parseando respuesta de identificación:", error.message);
      parsed = fallbackIdentificationResponse();
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
    return handleIaControllerError(res, error, "El servicio de identificación no está disponible");
  }
};

export const validarRegistroFaunaFlora = async (req, res) => {
  try {
    let payload;
    try {
      payload = validateContextualValidationInput(req.body);
    } catch (error) {
      return respondWithError(res, 400, "VALIDATION_FIELDS_REQUIRED", error.message);
    }

    const validationHash = hashValidationPayload(payload);
    const cached = getFromCache(validationHash);
    if (cached) {
      console.log(`[IA] Validación desde caché para hash ${validationHash.slice(0, 19)}...`);
      return res.status(200).json({ ...cached, cache_hit: true });
    }

    const {
      nombre_comun,
      nombre_cientifico,
      especie,
      descripcion,
      tipo,
      comportamiento,
      estado_extincion,
      habitat,
    } = payload;

    const { primaryModel, fallbackModel } = createGeminiModelPair(genAI);
    const prompt = buildValidationPrompt({
      nombre_comun,
      nombre_cientifico,
      tipo,
      especie,
      descripcion,
      comportamiento,
      estado_extincion,
      habitat,
    });

    const result = await generateGeminiContentWithFallback(primaryModel, fallbackModel, [prompt]);
    let parsed;
    let usedFallbackResponse = false;
    try {
      parsed = parseJsonResponse(result.response.text());
    } catch (error) {
      console.error("Error parseando respuesta de validación:", error.message);
      parsed = fallbackValidationResponse();
      usedFallbackResponse = true;
    }

    if (!usedFallbackResponse) {
      setInCache(validationHash, parsed);
    }

    return res.status(200).json({ ...parsed, cache_hit: false });
  } catch (error) {
    console.error("Error en validación IA:", error);
    return handleIaControllerError(res, error, "El servicio de validación no está disponible");
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
