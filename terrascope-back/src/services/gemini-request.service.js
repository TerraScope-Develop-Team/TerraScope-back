export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";
export const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 12_000;
export const GEMINI_MAX_RETRIES = 1;
export const GEMINI_RETRY_DELAY_MS = 1_000;

export class GeminiTimeoutError extends Error {
  constructor(timeoutMs, options) {
    super(`Gemini no respondió en ${timeoutMs / 1000} segundos. Inténtalo nuevamente.`, options);
    this.name = "GeminiTimeoutError";
  }
}

export class GeminiRateLimitError extends Error {
  constructor(
    message = "El servicio de IA alcanzó temporalmente su límite de solicitudes. Inténtalo nuevamente en un minuto.",
    options,
  ) {
    super(message, options);
    this.name = "GeminiRateLimitError";
    this.statusCode = 429;
    this.code = "GEMINI_RATE_LIMIT";
  }
}

export function getGeminiErrorStatus(error) {
  return error?.status ?? error?.statusCode ?? null;
}

export function isGeminiRateLimitError(error) {
  if (!error) return false;
  if (error instanceof GeminiRateLimitError) return true;
  if (getGeminiErrorStatus(error) === 429) return true;
  return /429|resource_exhausted|quota|rate\s*limit/i.test(String(error?.message || ""));
}

/**
 * Resuelve los nombres de modelo principal y de respaldo desde variables de entorno.
 */
export function resolveGeminiModelNames(env = process.env) {
  const primary = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const hasCustomFallback = Object.prototype.hasOwnProperty.call(env, "GEMINI_FALLBACK_MODEL")
    && env.GEMINI_FALLBACK_MODEL !== undefined
    && env.GEMINI_FALLBACK_MODEL !== null;
  const rawFallback = hasCustomFallback
    ? String(env.GEMINI_FALLBACK_MODEL).trim()
    : DEFAULT_GEMINI_FALLBACK_MODEL;
  const fallback = !rawFallback || rawFallback === primary ? null : rawFallback;

  return { primary, fallback };
}

/**
 * Construye el par de instancias de modelos Gemini (principal y respaldo).
 */
export function createGeminiModelPair(genAI, env = process.env) {
  const { primary, fallback } = resolveGeminiModelNames(env);

  return {
    primaryModelName: primary,
    fallbackModelName: fallback,
    primaryModel: genAI.getGenerativeModel({ model: primary }),
    fallbackModel: fallback ? genAI.getGenerativeModel({ model: fallback }) : null,
  };
}

export async function generateGeminiContent(
  model,
  content,
  timeoutMs = GEMINI_TIMEOUT_MS,
  maxRetries = GEMINI_MAX_RETRIES,
) {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await model.generateContent(content, {
        timeout: timeoutMs,
        signal: controller.signal,
      });
    } catch (error) {
      if (
        controller.signal.aborted ||
        error.name === "AbortError" ||
        error.name === "TimeoutError"
      ) {
        throw new GeminiTimeoutError(timeoutMs, { cause: error });
      }

      if (getGeminiErrorStatus(error) !== 503 || attempt >= maxRetries) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_DELAY_MS));
  }
}

export async function generateGeminiContentWithFallback(
  primaryModel,
  fallbackModel,
  content,
  timeoutMs = GEMINI_TIMEOUT_MS,
) {
  try {
    return await generateGeminiContent(primaryModel, content, timeoutMs);
  } catch (error) {
    const isUnavailable = getGeminiErrorStatus(error) === 503;
    const isRateLimited = isGeminiRateLimitError(error);

    if (!isUnavailable && !isRateLimited) {
      throw error;
    }

    if (!fallbackModel) {
      if (isRateLimited) {
        throw new GeminiRateLimitError(undefined, { cause: error });
      }
      throw error;
    }

    try {
      return await generateGeminiContent(fallbackModel, content, timeoutMs, 0);
    } catch (fallbackError) {
      if (isGeminiRateLimitError(fallbackError)) {
        throw new GeminiRateLimitError(undefined, { cause: fallbackError });
      }
      throw fallbackError;
    }
  }
}