export const GEMINI_TIMEOUT_MS = 12_000;

export class GeminiTimeoutError extends Error {
  constructor(timeoutMs, options) {
    super(`Gemini no respondió en ${timeoutMs / 1000} segundos. Inténtalo nuevamente.`, options);
    this.name = "GeminiTimeoutError";
  }
}

export async function generateGeminiContent(model, content, timeoutMs = GEMINI_TIMEOUT_MS) {
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

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}