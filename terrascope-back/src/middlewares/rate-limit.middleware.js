import { checkRateLimit } from "../services/rate-limiter.service.js";

/**
 * Obtiene la dirección IP del cliente de manera confiable, considerando proxies e interfaces de red.
 *
 * @param {import("express").Request} req
 * @returns {string} IP normalizada del cliente
 */
export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded && typeof forwarded === "string") {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
};

/**
 * Generador de middleware para rate limiting en endpoints HTTP.
 *
 * @param {Object} options
 * @param {number} [options.windowMs] - Ventana de tiempo en milisegundos (default: 60000ms = 1m)
 * @param {number} [options.max] - Máximo de peticiones permitidas por ventana (default: 10)
 * @param {string|((retryAfter: number) => string)} [options.message] - Mensaje de error al superar el límite
 * @param {((req: import("express").Request) => string)} [options.keyGenerator] - Función para generar la clave de bloqueo
 * @param {number} [options.statusCode] - Código HTTP a responder (default: 429)
 * @returns {import("express").RequestHandler}
 */
export const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 10,
  message = "Has superado el límite de peticiones permitidas.",
  keyGenerator = (req) => getClientIp(req),
  statusCode = 429,
} = {}) => {
  return (req, res, next) => {
    const key = keyGenerator(req);
    if (!key) {
      return next();
    }

    const result = checkRateLimit(key, { windowMs, max });

    // Cabeceras estándar de Rate Limiting
    res.setHeader("X-RateLimit-Limit", String(result.limit));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetTime / 1000)));

    if (!result.allowed) {
      // Cabecera estándar HTTP Retry-After con el tiempo restante en segundos
      res.setHeader("Retry-After", String(result.retryAfterSeconds));

      const responseMessage =
        typeof message === "function"
          ? message(result.retryAfterSeconds)
          : message;

      return res.status(statusCode).json({
        statusCode: 429,
        error: "Too Many Requests",
        message: responseMessage,
        retryAfter: result.retryAfterSeconds,
      });
    }

    next();
  };
};

/**
 * Rate Limiter para el endpoint de inicio de sesión (/api/usuarios/login).
 * Limita los intentos por IP y/o correo electrónico para mitigar ataques de fuerza bruta y credential stuffing.
 * Por defecto: 5 intentos cada 15 minutos (configurable mediante variables de entorno).
 */
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5;

export const loginRateLimiter = createRateLimiter({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_MAX_ATTEMPTS,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const email = (req.body?.email_usuario || "").toString().trim().toLowerCase();
    return email ? `login:${ip}:${email}` : `login:${ip}`;
  },
  message: (retryAfter) => {
    const minutes = Math.ceil(retryAfter / 60);
    const timeText = minutes > 1 ? `${minutes} minutos` : `${retryAfter} segundos`;
    return `Has superado el límite de intentos de inicio de sesión (${LOGIN_MAX_ATTEMPTS} intentos). Por favor, intenta de nuevo en ${timeText}.`;
  },
});

/**
 * Rate Limiter para el endpoint de identificación con IA (/api/ia/identificar).
 * Limita el consumo del servicio por usuario autenticado (o IP en fallback) para evitar abusos y costos excesivos en Gemini.
 * Por defecto: 10 peticiones por minuto (configurable mediante variables de entorno).
 */
const IA_WINDOW_MS = Number(process.env.IA_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const IA_MAX_REQUESTS = Number(process.env.IA_RATE_LIMIT_MAX) || 10;

export const iaRateLimiter = createRateLimiter({
  windowMs: IA_WINDOW_MS,
  max: IA_MAX_REQUESTS,
  keyGenerator: (req) => {
    const userId = req.usuario?.id || req.user?.id;
    const ip = getClientIp(req);
    return userId ? `ia:${userId}` : `ia:${ip}`;
  },
  message: (retryAfter) => {
    return `Has superado el límite de solicitudes de identificación con IA (${IA_MAX_REQUESTS} por minuto). Por favor, espera ${retryAfter} segundos antes de volver a intentar.`;
  },
});
