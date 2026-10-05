import crypto from "crypto";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

/** @type {Map<string, { result: object, expiresAt: number }>} */
const cache = new Map();

// Contadores de métricas
const metrics = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

/**
 * Genera un hash SHA-256 del contenido completo de la imagen.
 *
 * @param {string} base64 - Imagen en base64
 * @returns {string} Hash hexadecimal
 */
export function hashImage(base64) {
  const imageBuffer = Buffer.from(base64, "base64");
  return crypto.createHash("sha256").update(imageBuffer).digest("hex");
}

/**
 * Consulta el caché por hash de imagen.
 *
 * @param {string} hash
 * @returns {object|null} Resultado cacheado o null si no existe / expiró
 */
export function getFromCache(hash) {
  metrics.totalRequests++;

  const entry = cache.get(hash);
  if (!entry) {
    metrics.cacheMisses++;
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(hash);
    metrics.cacheMisses++;
    console.log(`[IA Cache] Entrada expirada para hash ${hash.slice(0, 8)}...`);
    return null;
  }

  metrics.cacheHits++;
  console.log(`[IA Cache] HIT para hash ${hash.slice(0, 8)}... (${metrics.cacheHits} hits totales)`);
  return entry.result;
}

/**
 * Guarda un resultado en el caché con TTL de 24h.
 *
 * @param {string} hash
 * @param {object} result
 */
export function setInCache(hash, result) {
  cache.set(hash, {
    result,
    expiresAt: Date.now() + TTL_MS,
  });
  console.log(`[IA Cache] Guardado hash ${hash.slice(0, 8)}... (${cache.size} entradas en caché)`);
}

/**
 * Limpia todas las entradas expiradas del caché.
 * Se puede llamar periódicamente.
 */
export function purgeExpired() {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[IA Cache] Purge: ${removed} entradas eliminadas. Quedan ${cache.size}.`);
  }
}

/**
 * Devuelve las métricas actuales del caché.
 *
 * @returns {{ totalRequests: number, cacheHits: number, cacheMisses: number, hitRate: string, currentEntries: number }}
 */
export function getCacheStats() {
  const hitRate = metrics.totalRequests > 0
    ? ((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1) + "%"
    : "0%";

  return {
    totalRequests: metrics.totalRequests,
    cacheHits: metrics.cacheHits,
    cacheMisses: metrics.cacheMisses,
    hitRate,
    currentEntries: cache.size,
    ttlHours: TTL_MS / (60 * 60 * 1000),
  };
}
