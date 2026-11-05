import test from "node:test";
import assert from "node:assert/strict";
import {
  checkRateLimit,
  resetRateLimit,
  clearAllRateLimits,
  purgeExpiredRateLimits,
  getRateLimitStats,
} from "../src/services/rate-limiter.service.js";

test("checkRateLimit lanza error si la clave es nula o vacía", () => {
  assert.throws(() => {
    checkRateLimit("", { windowMs: 1000, max: 5 });
  }, /clave válida/);
});

test("checkRateLimit permite peticiones hasta el límite configurado", () => {
  clearAllRateLimits();
  const key = "test:user:1";
  const windowMs = 60 * 1000;
  const max = 3;
  const now = 100000;

  // Intento 1
  const r1 = checkRateLimit(key, { windowMs, max, now });
  assert.equal(r1.allowed, true);
  assert.equal(r1.current, 1);
  assert.equal(r1.limit, 3);
  assert.equal(r1.remaining, 2);
  assert.equal(r1.retryAfterSeconds, 0);

  // Intento 2
  const r2 = checkRateLimit(key, { windowMs, max, now: now + 1000 });
  assert.equal(r2.allowed, true);
  assert.equal(r2.current, 2);
  assert.equal(r2.remaining, 1);

  // Intento 3 (límite alcanzado)
  const r3 = checkRateLimit(key, { windowMs, max, now: now + 2000 });
  assert.equal(r3.allowed, true);
  assert.equal(r3.current, 3);
  assert.equal(r3.remaining, 0);

  // Intento 4 (excedido)
  const r4 = checkRateLimit(key, { windowMs, max, now: now + 3000 });
  assert.equal(r4.allowed, false);
  assert.equal(r4.current, 3);
  assert.equal(r4.remaining, 0);
  assert.equal(r4.limit, 3);
  assert.ok(r4.retryAfterSeconds > 0);
  // Ventana expira en now + windowMs = 160000. Tiempo restante = 160000 - 103000 = 57000ms => 57s
  assert.equal(r4.retryAfterSeconds, 57);
});

test("checkRateLimit reinicia la ventana una vez transcurrido windowMs", () => {
  clearAllRateLimits();
  const key = "test:user:reset";
  const windowMs = 1000;
  const max = 2;
  const now = 200000;

  // Consumir el límite
  checkRateLimit(key, { windowMs, max, now });
  checkRateLimit(key, { windowMs, max, now });
  const blocked = checkRateLimit(key, { windowMs, max, now: now + 500 });
  assert.equal(blocked.allowed, false);

  // Avanzar el tiempo más allá de windowMs
  const allowedAfter = checkRateLimit(key, { windowMs, max, now: now + 1001 });
  assert.equal(allowedAfter.allowed, true);
  assert.equal(allowedAfter.current, 1);
  assert.equal(allowedAfter.remaining, 1);
});

test("diferentes claves no interfieren entre sí", () => {
  clearAllRateLimits();
  const keyA = "ip:192.168.1.1";
  const keyB = "ip:192.168.1.2";
  const windowMs = 5000;
  const max = 1;

  const rA1 = checkRateLimit(keyA, { windowMs, max });
  assert.equal(rA1.allowed, true);

  const rA2 = checkRateLimit(keyA, { windowMs, max });
  assert.equal(rA2.allowed, false);

  // keyB no debe verse afectada por keyA
  const rB1 = checkRateLimit(keyB, { windowMs, max });
  assert.equal(rB1.allowed, true);
});

test("resetRateLimit elimina el registro de una clave", () => {
  clearAllRateLimits();
  const key = "test:reset:single";
  checkRateLimit(key, { windowMs: 60000, max: 1 });
  assert.equal(checkRateLimit(key, { windowMs: 60000, max: 1 }).allowed, false);

  const deleted = resetRateLimit(key);
  assert.equal(deleted, true);

  // Ahora debe permitir nuevamente
  assert.equal(checkRateLimit(key, { windowMs: 60000, max: 1 }).allowed, true);
});

test("purgeExpiredRateLimits elimina registros viejos y conserva los activos", () => {
  clearAllRateLimits();
  const baseTime = 1000000;

  checkRateLimit("expira:pronto", { windowMs: 1000, max: 5, now: baseTime });
  checkRateLimit("sigue:activo", { windowMs: 60000, max: 5, now: baseTime });

  assert.equal(getRateLimitStats(baseTime).totalTrackedKeys, 2);

  // Purgar en baseTime + 2000 (donde "expira:pronto" ya venció)
  const purged = purgeExpiredRateLimits(baseTime + 2000);
  assert.equal(purged, 1);

  const stats = getRateLimitStats(baseTime + 2000);
  assert.equal(stats.totalTrackedKeys, 1);
  assert.equal(stats.activeKeys, 1);
});
