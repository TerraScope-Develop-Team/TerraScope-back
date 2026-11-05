/**
 * Servicio de Rate Limiting en memoria para control de peticiones concurrentes y mitigación de abuso.
 * Soporta ventanas de tiempo configurables, purga periódica y cálculo de cabeceras estándar (Retry-After, X-RateLimit-*).
 */

/**
 * @typedef {Object} RateLimitEntry
 * @property {number} count - Número actual de peticiones registradas en la ventana
 * @property {number} resetTime - Timestamp (ms) en el que expira la ventana actual
 */

/** @type {Map<string, RateLimitEntry>} */
const store = new Map();

/**
 * Verifica y registra un intento para una clave dada dentro de una ventana de tiempo.
 *
 * @param {string} key - Identificador único (IP, userId, email o combinación)
 * @param {Object} options
 * @param {number} options.windowMs - Duración de la ventana en milisegundos
 * @param {number} options.max - Número máximo de intentos permitidos en la ventana
 * @param {number} [options.now] - Timestamp actual (útil para pruebas)
 * @returns {{
 *   allowed: boolean,
 *   current: number,
 *   limit: number,
 *   remaining: number,
 *   resetTime: number,
 *   retryAfterSeconds: number
 * }}
 */
export function checkRateLimit(key, { windowMs, max, now = Date.now() }) {
  if (!key) {
    throw new Error("Se requiere una clave válida para verificar el rate limit.");
  }

  const entry = store.get(key);

  // Si no existe o la ventana anterior ya expiró, inicializamos una nueva ventana
  if (!entry || now >= entry.resetTime) {
    const newEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    store.set(key, newEntry);

    return {
      allowed: true,
      current: 1,
      limit: max,
      remaining: Math.max(0, max - 1),
      resetTime: newEntry.resetTime,
      retryAfterSeconds: 0,
    };
  }

  // La ventana sigue vigente
  if (entry.count >= max) {
    const retryAfterMs = Math.max(0, entry.resetTime - now);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      current: entry.count,
      limit: max,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfterSeconds,
    };
  }

  // Incrementar contador
  entry.count += 1;
  const remaining = Math.max(0, max - entry.count);

  return {
    allowed: true,
    current: entry.count,
    limit: max,
    remaining,
    resetTime: entry.resetTime,
    retryAfterSeconds: 0,
  };
}

/**
 * Elimina el registro de una clave específica (por ejemplo tras login exitoso o desbloqueo manual).
 *
 * @param {string} key
 * @returns {boolean} True si la clave existía y fue eliminada
 */
export function resetRateLimit(key) {
  return store.delete(key);
}

/**
 * Limpia todos los registros almacenados (útil en pruebas).
 */
export function clearAllRateLimits() {
  store.clear();
}

/**
 * Purga del almacenamiento todas las entradas cuya ventana ya expiró para evitar fugas de memoria.
 *
 * @param {number} [now]
 * @returns {number} Cantidad de entradas eliminadas
 */
export function purgeExpiredRateLimits(now = Date.now()) {
  let purged = 0;
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetTime) {
      store.delete(key);
      purged += 1;
    }
  }
  if (purged > 0) {
    console.log(`[Rate Limit] Purge: ${purged} registros expirados eliminados. Restantes: ${store.size}`);
  }
  return purged;
}

/**
 * Retorna estadísticas de uso del rate limiter en memoria.
 *
 * @param {number} [now]
 * @returns {{ totalTrackedKeys: number, activeKeys: number, expiredKeys: number }}
 */
export function getRateLimitStats(now = Date.now()) {
  let activeKeys = 0;
  let expiredKeys = 0;

  for (const [, entry] of store.entries()) {
    if (now < entry.resetTime) {
      activeKeys += 1;
    } else {
      expiredKeys += 1;
    }
  }

  return {
    totalTrackedKeys: store.size,
    activeKeys,
    expiredKeys,
  };
}
