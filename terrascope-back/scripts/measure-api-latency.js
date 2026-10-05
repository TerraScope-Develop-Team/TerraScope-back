import { performance } from "node:perf_hooks";

const baseUrl = (process.env.API_BASE_URL || "http://127.0.0.1:3000/api").replace(/\/$/, "");
const virtualUsers = Math.max(1, Number.parseInt(process.env.LOAD_VUS || "4", 10));
const durationMs = Math.max(1000, Number.parseInt(process.env.LOAD_DURATION_MS || "12000", 10));
const requestTimeoutMs = Math.max(1000, Number.parseInt(process.env.LOAD_TIMEOUT_MS || "15000", 10));
const token = process.env.API_TOKEN;

const routes = [
  { name: "avistamientos", path: "/fauna-flora?page=1&limit=50" },
  { name: "busqueda", path: "/fauna-flora?buscar=ave&limit=50" },
  { name: "zonas_mapa", path: "/fauna-flora/frequent-zones" },
  { name: "habitats", path: "/habitats" },
];

if (token) {
  routes.push({ name: "usuarios", path: "/usuarios" });
}

const results = new Map(routes.map(({ name }) => [name, { latencies: [], failures: 0 }]));
const deadline = Date.now() + durationMs;

async function runWorker(workerIndex) {
  let requestIndex = workerIndex;

  while (Date.now() < deadline) {
    const route = routes[requestIndex % routes.length];
    requestIndex += virtualUsers;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
    const startedAt = performance.now();

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await fetch(`${baseUrl}${route.path}`, {
        headers,
        signal: controller.signal,
      });
      await response.arrayBuffer();

      const result = results.get(route.name);
      result.latencies.push(performance.now() - startedAt);
      if (!response.ok) result.failures++;
    } catch {
      results.get(route.name).failures++;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

await Promise.all(Array.from({ length: virtualUsers }, (_, index) => runWorker(index)));

console.log(`Base URL: ${baseUrl}`);
console.log(`Carga: ${virtualUsers} usuarios virtuales durante ${durationMs} ms`);
console.log(`Umbral p95: 1500 ms; usuarios protegidos: ${token ? "incluidos" : "omitidos (define API_TOKEN para incluirlos)"}`);

let thresholdExceeded = false;
for (const [name, result] of results) {
  const p50 = percentile(result.latencies, 0.5);
  const p95 = percentile(result.latencies, 0.95);
  const p99 = percentile(result.latencies, 0.99);
  const maximum = result.latencies.length ? Math.max(...result.latencies) : null;
  const failed = result.failures > 0;
  const exceeded = p95 !== null && p95 > 1500;
  thresholdExceeded ||= failed || exceeded;

  console.log(
    `${name}: requests=${result.latencies.length + result.failures}, failures=${result.failures}, p50=${p50?.toFixed(1) ?? "n/a"}ms, p95=${p95?.toFixed(1) ?? "n/a"}ms, p99=${p99?.toFixed(1) ?? "n/a"}ms, max=${maximum?.toFixed(1) ?? "n/a"}ms${exceeded ? " [SLA EXCEEDED]" : ""}`,
  );
}

if (thresholdExceeded && process.env.FAIL_ON_SLA === "1") {
  process.exitCode = 1;
}