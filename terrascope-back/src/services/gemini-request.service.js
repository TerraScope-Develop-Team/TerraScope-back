export const GEMINI_TIMEOUT_MS = 12_000;
export const GEMINI_MAX_RETRIES = 1;
export const GEMINI_RETRY_DELAY_MS = 1_000;

export class GeminiTimeoutError extends Error {
  constructor(timeoutMs, options) {
    super(`Gemini no respondió en ${timeoutMs / 1000} segundos. Inténtalo nuevamente.`, options);
    this.name = "GeminiTimeoutError";
  }
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

      if (error.status !== 503 || attempt >= maxRetries) {
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
    if (error.status !== 503) {
      throw error;
    }

    return generateGeminiContent(fallbackModel, content, timeoutMs, 0);
  }
}