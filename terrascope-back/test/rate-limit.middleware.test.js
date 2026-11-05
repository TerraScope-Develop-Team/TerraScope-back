import test from "node:test";
import assert from "node:assert/strict";
import {
  getClientIp,
  createRateLimiter,
  loginRateLimiter,
  iaRateLimiter,
} from "../src/middlewares/rate-limit.middleware.js";
import { clearAllRateLimits } from "../src/services/rate-limiter.service.js";

/**
 * Mock sencillo de objetos req, res y next de Express para pruebas unitarias.
 */
function createMockHttp({ ip = "127.0.0.1", headers = {}, body = {}, usuario = null } = {}) {
  const resHeaders = {};
  let statusCode = 200;
  let responseData = null;

  const req = {
    ip,
    headers,
    body,
    usuario,
    user: usuario,
    socket: { remoteAddress: ip },
  };

  const res = {
    setHeader(name, value) {
      resHeaders[name.toLowerCase()] = String(value);
      return res;
    },
    getHeader(name) {
      return resHeaders[name.toLowerCase()];
    },
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    get headers() {
      return resHeaders;
    },
    get statusCode() {
      return statusCode;
    },
    get responseData() {
      return responseData;
    },
  };

  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  return { req, res, next, wasNextCalled: () => nextCalled };
}

test("getClientIp extrae la IP de x-forwarded-for o req.ip", () => {
  const { req: r1 } = createMockHttp({
    headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
  });
  assert.equal(getClientIp(r1), "203.0.113.195");

  const { req: r2 } = createMockHttp({ ip: "192.168.3.45" });
  assert.equal(getClientIp(r2), "192.168.3.45");
});

test("createRateLimiter permite peticiones y añade cabeceras X-RateLimit-*", () => {
  clearAllRateLimits();
  const limiter = createRateLimiter({
    windowMs: 60000,
    max: 2,
    keyGenerator: () => "test:custom:key",
  });

  const { req, res, next, wasNextCalled } = createMockHttp();
  limiter(req, res, next);

  assert.equal(wasNextCalled(), true);
  assert.equal(res.getHeader("x-ratelimit-limit"), "2");
  assert.equal(res.getHeader("x-ratelimit-remaining"), "1");
  assert.ok(res.getHeader("x-ratelimit-reset"));
});

test("createRateLimiter responde con 429 y Retry-After al sobrepasar el límite", () => {
  clearAllRateLimits();
  const limiter = createRateLimiter({
    windowMs: 60000,
    max: 1,
    keyGenerator: () => "test:block:key",
    message: "Límite excedido de prueba",
  });

  // Petición 1 (permitida)
  const http1 = createMockHttp();
  limiter(http1.req, http1.res, http1.next);
  assert.equal(http1.wasNextCalled(), true);

  // Petición 2 (bloqueada con 429)
  const http2 = createMockHttp();
  limiter(http2.req, http2.res, http2.next);

  assert.equal(http2.wasNextCalled(), false);
  assert.equal(http2.res.statusCode, 429);
  assert.equal(http2.res.getHeader("x-ratelimit-remaining"), "0");
  assert.ok(Number(http2.res.getHeader("retry-after")) > 0);

  assert.deepEqual(http2.res.responseData, {
    statusCode: 429,
    error: "Too Many Requests",
    message: "Límite excedido de prueba",
    retryAfter: Number(http2.res.getHeader("retry-after")),
  });
});

test("loginRateLimiter limita a 5 intentos por IP/usuario y bloquea en el 6to con 429", () => {
  clearAllRateLimits();
  const ip = "10.0.0.1";
  const email = "usuario@ejemplo.com";

  // Disparar 5 peticiones exitosas (dentro del límite)
  for (let i = 1; i <= 5; i++) {
    const { req, res, next, wasNextCalled } = createMockHttp({
      ip,
      body: { email_usuario: email },
    });
    loginRateLimiter(req, res, next);
    assert.equal(wasNextCalled(), true, `El intento ${i} debe ser permitido`);
    assert.equal(res.getHeader("x-ratelimit-remaining"), String(5 - i));
  }

  // Petición 6 (debe disparar 429)
  const { req, res, next, wasNextCalled } = createMockHttp({
    ip,
    body: { email_usuario: email },
  });
  loginRateLimiter(req, res, next);

  assert.equal(wasNextCalled(), false, "El intento 6 debe ser bloqueado");
  assert.equal(res.statusCode, 429);
  assert.ok(Number(res.getHeader("retry-after")) > 0);
  assert.equal(res.responseData.statusCode, 429);
  assert.equal(res.responseData.error, "Too Many Requests");
  assert.match(res.responseData.message, /Has superado el límite de intentos de inicio de sesión/);
});

test("iaRateLimiter limita a 10 solicitudes por minuto por usuario autenticado y bloquea la 11ª con 429", () => {
  clearAllRateLimits();
  const usuario = { id: "user-ia-123", nombre_usuario: "Investigador" };

  // Disparar 10 peticiones (dentro del límite)
  for (let i = 1; i <= 10; i++) {
    const { req, res, next, wasNextCalled } = createMockHttp({
      ip: "192.168.1.50",
      usuario,
    });
    iaRateLimiter(req, res, next);
    assert.equal(wasNextCalled(), true, `La petición IA ${i} debe ser permitida`);
  }

  // Petición 11 (debe disparar 429)
  const { req, res, next, wasNextCalled } = createMockHttp({
    ip: "192.168.1.50",
    usuario,
  });
  iaRateLimiter(req, res, next);

  assert.equal(wasNextCalled(), false, "La petición 11 de IA debe ser bloqueada");
  assert.equal(res.statusCode, 429);
  assert.ok(Number(res.getHeader("retry-after")) > 0);
  assert.equal(res.responseData.statusCode, 429);
  assert.equal(res.responseData.error, "Too Many Requests");
  assert.match(res.responseData.message, /Has superado el límite de solicitudes de identificación con IA/);
});

test("iaRateLimiter aísla usuarios diferentes", () => {
  clearAllRateLimits();
  const userA = { id: "user-A" };
  const userB = { id: "user-B" };

  // Bloquear a userA con 10 peticiones
  for (let i = 0; i < 10; i++) {
    const { req, res, next } = createMockHttp({ usuario: userA });
    iaRateLimiter(req, res, next);
  }

  const blockedA = createMockHttp({ usuario: userA });
  iaRateLimiter(blockedA.req, blockedA.res, blockedA.next);
  assert.equal(blockedA.res.statusCode, 429);

  // userB debe seguir teniendo su cuota completa
  const allowedB = createMockHttp({ usuario: userB });
  iaRateLimiter(allowedB.req, allowedB.res, allowedB.next);
  assert.equal(allowedB.wasNextCalled(), true);
  assert.equal(allowedB.res.getHeader("x-ratelimit-remaining"), "9");
});
